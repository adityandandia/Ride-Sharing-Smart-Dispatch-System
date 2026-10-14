'use client';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api<{ role: string }>('/api/auth/login', { body: { email, password } });
      window.location.href = r.role === 'Admin' ? '/admin' : r.role === 'Driver' ? '/driver' : '/rider';
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  return (
    <main className="auth card">
      <h1>Sign in to Dispatch</h1>
      <p className="muted">Book a ride, drive, or run operations.</p>
      <form onSubmit={submit}>
        <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="muted">New here? <a href="/register">Create an account</a></p>
      <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
      <p className="muted">Demo logins (password <b>password123</b>): rider1@ride.test, driver1@ride.test, admin@ride.test</p>
    </main>
  );
}
