'use client';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export default function Register() {
  const [role, setRole] = useState<'Rider' | 'Driver'>('Rider');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', licenseNo: '', plateNo: '', model: '', type: 'Sedan' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const payload: any = { name: f.name, email: f.email, password: f.password, role, ...(f.phone && { phone: f.phone }) };
    if (role === 'Driver') {
      payload.licenseNo = f.licenseNo;
      payload.vehicle = { plateNo: f.plateNo, model: f.model, type: f.type, seats: 4 };
    }
    try {
      await api('/api/auth/register', { body: payload });
      window.location.href = role === 'Driver' ? '/driver' : '/rider';
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  return (
    <main className="auth card">
      <h1>Create your account</h1>
      <div className="seg" role="group" aria-label="Account type">
        {(['Rider', 'Driver'] as const).map((r) => (
          <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>{r === 'Rider' ? 'I need rides' : 'I drive'}</button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label className="field"><span>Full name</span><input value={f.name} onChange={set('name')} required minLength={2} /></label>
        <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set('email')} required /></label>
        <label className="field"><span>Phone (optional)</span><input value={f.phone} onChange={set('phone')} /></label>
        <label className="field"><span>Password (8+ characters)</span><input type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /></label>
        {role === 'Driver' && (
          <>
            <label className="field"><span>Licence number</span><input value={f.licenseNo} onChange={set('licenseNo')} required minLength={5} /></label>
            <div className="row">
              <label className="field"><span>Number plate</span><input value={f.plateNo} onChange={set('plateNo')} required minLength={4} /></label>
              <label className="field"><span>Vehicle type</span>
                <select value={f.type} onChange={set('type')}>{['Auto', 'Mini', 'Sedan', 'SUV'].map((t) => <option key={t}>{t}</option>)}</select>
              </label>
            </div>
            <label className="field"><span>Vehicle model</span><input value={f.model} onChange={set('model')} required minLength={2} /></label>
          </>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="muted">Already registered? <a href="/login">Sign in</a></p>
    </main>
  );
}
