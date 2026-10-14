export async function api<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    // session expired or revoked in Redis
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export const inr = (n: number | string) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
