"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/AuthContext';

type FieldType = 'counter' | 'checkbox' | 'text' | 'multiselect';

type FormField = {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // for multiselect
};
type FormTemplateRow = {
  form_definition: FormField[] | null;
};

export default function FormBuilderPage() {
  const defaultSeason = new Date().getFullYear();
  useRequireAuth();
  const [season, setSeason] = useState<number>(defaultSeason);
  const [fields, setFields] = useState<FormField[]>([]);
  const [status, setStatus] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newType, setNewType] = useState<FieldType>('counter');
  const [newOptions, setNewOptions] = useState<string>('');

  useEffect(() => {
    async function load() {
      setStatus('Loading form...');
      const { data, error } = await supabase
        .from('form_templates')
        .select('form_definition')
        .eq('season', season)
        .maybeSingle<FormTemplateRow>();
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        const def = data?.form_definition ?? [];
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
    <div className="p-6 max-w-3xl mx-auto">
      <h1>Form Builder</h1>

      <div className="flex gap-3 items-center mt-3">
        <label className="flex items-center gap-2">
          Season:
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(parseInt(e.target.value || String(defaultSeason), 10))}
            className="ml-2 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button onClick={save} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Save</button>
        <span className="text-zinc-500 dark:text-zinc-400">{status}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <h2>Fields</h2>
        {fields.length === 0 && <div>No fields yet.</div>}
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-3 items-center">
            <span className="w-28 font-mono text-zinc-900 dark:text-zinc-100">{f.type}</span>
            <span className="flex-1 text-zinc-900 dark:text-zinc-100">{f.label}</span>
            <div className="flex gap-2">
              <button
                onClick={() => moveField(f.id, 'up')}
                disabled={i === 0}
                className={`px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800${i === 0 ? ' opacity-50' : ''}`}
              >
                ↑
              </button>
              <button
                onClick={() => moveField(f.id, 'down')}
                disabled={i === fields.length - 1}
                className={`px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800${i === fields.length - 1 ? ' opacity-50' : ''}`}
              >
                ↓
              </button>
              <button onClick={() => removeField(f.id)} className="px-3 py-2 rounded-md bg-red-600 text-white font-medium hover:bg-red-700">Remove</button>
            </div>
          </div>
        ))}

        <div className="flex gap-3 items-center mt-3">
          <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} className="px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            <option value="counter">Counter</option>
            <option value="checkbox">Checkbox</option>
            <option value="text">Text Input</option>
            <option value="multiselect">Multi‑select</option>
          </select>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g., Auto Amp Notes)"
            className="flex-1 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
          {newType === 'multiselect' && (
            <input
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options comma‑separated (e.g., Deep, Shallow, Park, None)"
              className="flex-1 px-2 py-1.5 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          )}
          <button onClick={addField} className="px-3 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Add Field</button>
        </div>
      </div>
    </div>
  );
}

