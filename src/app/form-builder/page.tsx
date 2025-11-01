"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type FieldType = 'counter' | 'checkbox' | 'text' | 'multiselect';

type FormField = {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // for multiselect
};

export default function FormBuilderPage() {
  const defaultSeason = new Date().getFullYear();
  const router = useRouter();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [fields, setFields] = useState<FormField[]>([]);
  const [status, setStatus] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newType, setNewType] = useState<FieldType>('counter');
  const [newOptions, setNewOptions] = useState<string>('');

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
    const field: FormField = { id, label: newLabel.trim(), type: newType };
    if (newType === 'multiselect') {
      field.options = newOptions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    setFields((prev) => [...prev, field]);
    setNewLabel('');
    setNewOptions('');
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function moveField(id: string, direction: 'up' | 'down') {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = tmp;
      return next;
    });
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
        {fields.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 120, fontFamily: 'monospace' }}>{f.type}</span>
            <span style={{ flex: 1 }}>{f.label}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => moveField(f.id, 'up')}
                disabled={i === 0}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', opacity: i === 0 ? 0.5 : 1 }}
              >
                ↑
              </button>
              <button
                onClick={() => moveField(f.id, 'down')}
                disabled={i === fields.length - 1}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', opacity: i === fields.length - 1 ? 0.5 : 1 }}
              >
                ↓
              </button>
              <button onClick={() => removeField(f.id)} style={{ padding: 6, borderRadius: 6, background: '#eee' }}>Remove</button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} style={{ padding: 6 }}>
            <option value="counter">Counter</option>
            <option value="checkbox">Checkbox</option>
            <option value="text">Text Input</option>
            <option value="multiselect">Multi‑select</option>
          </select>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g., Auto Amp Notes)"
            style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 6 }}
          />
          {newType === 'multiselect' && (
            <input
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options comma‑separated (e.g., Deep, Shallow, Park, None)"
              style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 6 }}
            />
          )}
          <button onClick={addField} style={{ padding: 8, borderRadius: 6, background: '#111', color: '#fff' }}>Add Field</button>
        </div>
      </div>
    </div>
  );
}


