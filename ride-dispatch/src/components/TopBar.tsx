'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function TopBar() {
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  useEffect(() => { api('/api/auth/me').then(setMe).catch(() => {}); }, []);
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <header className="top">
      <div className="brand"><i /> Dispatch</div>
      <div className="who">
        {me && <span>{me.name} · {me.role}</span>}
        <button className="btn small" onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}
