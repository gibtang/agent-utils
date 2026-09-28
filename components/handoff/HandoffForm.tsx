'use client';
import { FormEvent, useState } from 'react';

type Field = { name: string; label: string; helpText?: string; type: 'email' | 'text' | 'password' | 'textarea'; required: boolean; prefill?: string };
export default function HandoffForm({ handoffId, token, title, fields }: { handoffId: string; token: string; title: string | null; fields: Field[] }) {
  const [error, setError] = useState(''); const [submitted, setSubmitted] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget);
    if (String(form.get('website') ?? '')) return setSubmitted(true);
    const values: Record<string, string> = {};
    for (const field of fields) { const value = String(form.get(field.name) ?? ''); if (field.type === 'password' && value !== String(form.get(`${field.name}_confirm`) ?? '')) { setError('Check the required fields.'); return; } values[field.name] = value; }
    const response = await fetch('/api/handoff-submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handoffId, token, values, website: '' }) });
    if (response.ok) setSubmitted(true); else { const body = await response.json().catch(() => null); setError(body?.error?.code === 'validation_failed' ? 'Check the required fields.' : 'Unable to submit this form.'); }
  }
  if (submitted) return <section><p>Submitted. The requester can now decrypt.</p><p>Fields received: {fields.map((field) => field.name).join(', ')}</p></section>;
  return <form onSubmit={submit}><h1>{title ?? 'Secure handoff'}</h1>{fields.map((field) => <label key={field.name}>{field.label}{field.required ? ' *' : ''}{field.helpText ? <small>{field.helpText}</small> : null}{field.type === 'textarea' ? <textarea name={field.name} required={field.required} defaultValue={field.prefill} /> : <input name={field.name} type={field.type} required={field.required} defaultValue={field.prefill} />}{field.type === 'password' ? <input aria-label={`${field.label} confirmation`} name={`${field.name}_confirm`} type="password" required={field.required} /> : null}</label>)}<input name="website" className="sr-only" tabIndex={-1} autoComplete="off" /><button type="submit">Submit</button>{error ? <p role="alert">{error}</p> : null}</form>;
}
