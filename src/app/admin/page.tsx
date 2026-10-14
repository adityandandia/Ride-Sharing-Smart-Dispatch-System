'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { api, inr } from '@/lib/api';

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [pMsg, setPMsg] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<any[] | null>(null);
  const [sMsg, setSMsg] = useState('');

  const load = useCallback(async () => {
    try { setStats(await api('/api/admin/analytics')); setPricing(await api('/api/admin/pricing')); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  async function savePricing(e: FormEvent) {
    e.preventDefault(); setPMsg('');
    try {
      await api('/api/admin/pricing', { method: 'PUT', body: {
        baseFare: Number(pricing.baseFare), perKm: Number(pricing.perKm), perMin: Number(pricing.perMin), minFare: Number(pricing.minFare),
        surgeOverride: pricing.surgeOverride === '' || pricing.surgeOverride === null ? null : Number(pricing.surgeOverride),
      } });
      setPMsg('Pricing saved. New bookings use it immediately.');
    } catch (err: any) { setPMsg(err.message); }
  }
  async function search(e: FormEvent) {
    e.preventDefault(); setSMsg(''); setHits(null);
    try { setHits((await api('/api/admin/disputes/search', { body: { query } })).results); }
    catch (err: any) { setSMsg(err.message); }
  }
  async function reindex() {
    setSMsg('Indexing complaints. The first run downloads the embedding model and can take a minute…');
    try { const r = await api('/api/admin/disputes/reindex', { method: 'POST', body: {} }); setSMsg(`Indexed ${r.indexed} complaints.`); }
    catch (err: any) { setSMsg(err.message); }
  }

  if (!stats || !pricing) return <><TopBar /><main className="page"><p className="muted">Loading analytics…</p></main></>;
  const count = (arr: any[], k: string) => arr.find((x) => x.status === k)?.n ?? 0;
  const setP = (k: string) => (e: any) => setPricing({ ...pricing, [k]: e.target.value });

  return (
    <>
      <TopBar />
      <main className="page stack">
        <h1>Operations</h1>
        <div className="stats">
          <div className="card stat"><b>{inr(stats.revenue)}</b><span className="muted">Paid revenue</span></div>
          <div className="card stat"><b>{count(stats.byStatus, 'Completed')}</b><span className="muted">Completed trips</span></div>
          <div className="card stat"><b>{count(stats.byStatus, 'Matched') + count(stats.byStatus, 'InProgress')}</b><span className="muted">Trips live now</span></div>
          <div className="card stat"><b>{count(stats.fleet, 'Available')}/{count(stats.fleet, 'Available') + count(stats.fleet, 'Busy') + count(stats.fleet, 'Offline')}</b><span className="muted">Drivers available</span></div>
          <div className="card stat"><b>{stats.openComplaints}</b><span className="muted">Open disputes</span></div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <section className="card">
            <h2>Top drivers</h2>
            <table>
              <thead><tr><th>Driver</th><th>Trips</th><th>Rating</th></tr></thead>
              <tbody>{stats.topDrivers.map((d: any) => <tr key={d.name}><td>{d.name}</td><td>{d.trips}</td><td>{Number(d.rating_avg).toFixed(2)}★ ({d.rating_count})</td></tr>)}</tbody>
            </table>
            <h3 style={{ marginTop: '1rem' }}>Last 7 days</h3>
            {stats.perDay.length === 0 ? <p className="muted">No trips in the last week.</p> : (
              <table><thead><tr><th>Day</th><th>Trips</th><th>Gross</th></tr></thead>
                <tbody>{stats.perDay.map((d: any) => <tr key={d.day}><td>{String(d.day).slice(0, 10)}</td><td>{d.trips}</td><td>{inr(d.gross)}</td></tr>)}</tbody></table>
            )}
          </section>

          <section className="card">
            <h2>Pricing</h2>
            <form onSubmit={savePricing}>
              <div className="row">
                <label className="field"><span>Base fare (₹)</span><input type="number" step="0.01" min="0" value={pricing.baseFare} onChange={setP('baseFare')} required /></label>
                <label className="field"><span>Minimum fare (₹)</span><input type="number" step="0.01" min="0" value={pricing.minFare} onChange={setP('minFare')} required /></label>
              </div>
              <div className="row">
                <label className="field"><span>Per km (₹)</span><input type="number" step="0.01" min="0" value={pricing.perKm} onChange={setP('perKm')} required /></label>
                <label className="field"><span>Per minute (₹)</span><input type="number" step="0.01" min="0" value={pricing.perMin} onChange={setP('perMin')} required /></label>
              </div>
              <label className="field"><span>Surge override (1.00 to 5.00, leave empty for automatic demand-based surge)</span>
                <input type="number" step="0.05" min="1" max="5" value={pricing.surgeOverride ?? ''} onChange={setP('surgeOverride')} />
              </label>
              <button className="btn primary">Save pricing</button>
              {pMsg && <p className="muted">{pMsg}</p>}
            </form>
          </section>
        </div>

        <section className="card">
          <h2>Search disputes by meaning</h2>
          <p className="muted">Describe a problem in your own words. Complaints are ranked by cosine similarity of their embeddings in ChromaDB, even when the wording differs.</p>
          <form onSubmit={search} className="row">
            <input aria-label="Dispute search" placeholder="e.g. driver overcharged me or took a detour" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 4 }} />
            <button className="btn primary" disabled={query.trim().length < 3}>Search</button>
            <button type="button" className="btn" onClick={reindex}>Re-index complaints</button>
          </form>
          {sMsg && <p className="muted">{sMsg}</p>}
          {hits && hits.length === 0 && <p className="muted">No matches. If this is a fresh install, click “Re-index complaints” first.</p>}
          {hits?.map((h) => (
            <div className="hit" key={h.complaint_id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>Complaint #{h.complaint_id} · Trip #{h.trip_id}</b>
                <span className="sim">{Math.round(h.similarity * 100)}% match</span>
              </div>
              <p style={{ margin: '.25rem 0' }}>{h.description}</p>
              <span className="muted">{h.rider_name} about {h.driver_name ?? 'unassigned driver'} · fare {inr(h.fare)} ({h.surge_multiplier}x surge)</span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
