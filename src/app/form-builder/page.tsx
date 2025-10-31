"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type FieldType = 'counter' | 'checkbox' | 'text';

type FormField = {
  id: string;
  label: string;
  type: FieldType;
};

export default function FormBuilderPage() {
  const defaultSeason = new Date().getFullYear();
  const router = useRouter();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [fields, setFields] = useState<FormField[]>([]);
  const [status, setStatus] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newType, setNewType] = useState<FieldType>('counter');

  useEffect(() => {
    // require auth
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
    async function load() {
      setStatus('Loading form...');
      const { data, error } = await supabase
        .from('form_templates')
        .select('form_definition')
        .eq('season', season)
        .maybeSingle();
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        const def = (data?.form_definition as any) ?? [];
        setFields(Array.isArray(def) ? def : []);
        setStatus(data ? 'Loaded.' : 'No template yet for this season.');
      }
    }
    load();
  }, [season]);

  function addField() {
    if (!newLabel.trim()) return;
    const id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    setFields((prev) => [...prev, { id, label: newLabel.trim(), type: newType }]);
    setNewLabel('');
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function save() {
    setStatus('Saving...');
    const { error } = await supabase
      .from('form_templates')
      .upsert({ season, form_definition: fields }, { onConflict: 'season' });
    setStatus(error ? `Error: ${error.message}` : 'Saved.');
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>Form Builder</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <label>
          Season:
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))}
            style={{ marginLeft: 8, padding: 6, border: '1px solid #ccc', borderRadius: 6 }}
          />
        </label>
        <button onClick={save} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Save</button>
        <span style={{ color: '#555' }}>{status}</span>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <h2>Fields</h2>
        {fields.length === 0 && <div>No fields yet.</div>}
        {fields.map((f) => (
          <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 120, fontFamily: 'monospace' }}>{f.type}</span>
            <span>{f.label}</span>
            <button onClick={() => removeField(f.id)} style={{ marginLeft: 'auto', padding: 6, borderRadius: 6, background: '#eee' }}>Remove</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} style={{ padding: 6 }}>
            <option value="counter">Counter</option>
            <option value="checkbox">Checkbox</option>
            <option value="text">Text Input</option>
          </select>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g., Auto Amp Notes)"
            style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 6 }}
          />
          <button onClick={addField} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Add Field</button>
        </div>
      </div>
    </div>
  );
}


