'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { api, inr } from '@/lib/api';
import type { MapMarker } from '@/components/GeoMap';

const GeoMap = dynamic(() => import('@/components/GeoMap'), { ssr: false });
type Pt = { lat: number; lng: number };

function HistoryItem({ t, onChange }: { t: any; onChange: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [issue, setIssue] = useState('');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  async function review() {
    try { await api('/api/reviews', { body: { tripId: t.trip_id, rating, comment: comment || undefined } }); onChange(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function report() {
    try {
      const r = await api('/api/support/complaints', { body: { tripId: t.trip_id, description: issue } });
      setMsg(r.indexed ? 'Report sent. Our team will look into it.' : 'Report saved. Search indexing is catching up.');
      setOpen(false); setIssue('');
    } catch (e: any) { setMsg(e.message); }
  }

  return (
    <div className="hit">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>{t.pickup_address || 'Pickup'} → {t.dropoff_address || 'Drop-off'}</b>
        <span className={`pill ${t.status}`}>{t.status}</span>
      </div>
      <div className="muted">{inr(t.fare)} · {t.distance_km} km{t.driver_name ? ` · ${t.driver_name}` : ''}{Number(t.surge_multiplier) > 1 ? ` · ${t.surge_multiplier}x surge` : ''}</div>
      {t.status === 'Completed' && !t.reviewed && (
        <div className="row" style={{ marginTop: '.5rem' }}>
          <select aria-label="Rating" value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ maxWidth: 110 }}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 && 's'}</option>)}
          </select>
          <input aria-label="Comment" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn small" onClick={review}>Rate driver</button>
        </div>
      )}
      {t.status === 'Completed' && (
        <>
          <button className="btn small" style={{ marginTop: '.5rem' }} onClick={() => setOpen(!open)}>Report a problem</button>
          {open && (
            <div style={{ marginTop: '.5rem' }}>
              <textarea aria-label="Describe the problem" placeholder="What went wrong? (10+ characters)" value={issue} onChange={(e) => setIssue(e.target.value)} />
              <button className="btn small primary" disabled={issue.trim().length < 10} onClick={report}>Send report</button>
            </div>
          )}
        </>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

export default function RiderPage() {
  const [pickup, setPickup] = useState<Pt | null>(null);
  const [dropoff, setDropoff] = useState<Pt | null>(null);
  const [payment, setPayment] = useState('UPI');
  const [state, setState] = useState<any>({ active: null, driverLocation: null, history: [] });
  const [nearby, setNearby] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setState(await api('/api/rider/trips')); } catch {}
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 4000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => {
    if (state.active) return;
    const p = pickup ?? { lat: 12.9716, lng: 77.5946 };
    api(`/api/rider/nearby?lat=${p.lat}&lng=${p.lng}`).then(setNearby).catch(() => {});
  }, [pickup, state.active]);

  function onMapClick(lat: number, lng: number) {
    if (state.active) return;
    if (!pickup || (pickup && dropoff)) { setPickup({ lat, lng }); setDropoff(null); } else setDropoff({ lat, lng });
  }

  async function request() {
    if (!pickup || !dropoff) return;
    setBusy(true); setError('');
    try {
      await api('/api/rider/trips', { body: { pickup, dropoff, paymentMethod: payment, pickupAddress: 'Pinned pickup', dropoffAddress: 'Pinned drop-off' } });
      setPickup(null); setDropoff(null); await refresh();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  async function cancel() {
    try { await api(`/api/rider/trips/${state.active.trip_id}`, { body: { action: 'cancel' } }); await refresh(); }
    catch (e: any) { setError(e.message); }
  }

  const a = state.active;
  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (a) {
      m.push({ lat: a.pickup_lat, lng: a.pickup_lng, color: '#0B7A75', label: 'Pickup' });
      m.push({ lat: a.dropoff_lat, lng: a.dropoff_lng, color: '#B83A1B', label: 'Drop-off' });
      if (state.driverLocation) m.push({ lat: state.driverLocation.lat, lng: state.driverLocation.lng, color: '#FFB000', label: a.driver_name, radius: 11 });
    } else {
      nearby.forEach((d) => m.push({ lat: d.lat, lng: d.lng, color: '#FFB000', label: `Driver · ${Math.round(d.dist_m)} m`, radius: 7 }));
      if (pickup) m.push({ ...pickup, color: '#0B7A75', label: 'Pickup' });
      if (dropoff) m.push({ ...dropoff, color: '#B83A1B', label: 'Drop-off' });
    }
    return m;
  }, [a, state.driverLocation, nearby, pickup, dropoff]);

  return (
    <>
      <TopBar />
      <main className="page grid">
        <div className="stack">
          <h1>{a ? 'Your ride is on its way' : 'Where to?'}</h1>
          <GeoMap markers={markers} onClick={onMapClick} height={460} />
          {!a && <p className="muted">Tap the map to set your pickup, then tap again for the drop-off. Amber dots are available drivers.</p>}
        </div>

        <div className="stack">
          {a ? (
            <section className="card" aria-live="polite">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2>Trip #{a.trip_id}</h2><span className={`pill ${a.status}`}>{a.status}</span>
              </div>
              <p className="fare">{inr(a.fare)}</p>
              <dl className="kv">
                <dt>Driver</dt><dd>{a.driver_name} ({Number(a.driver_rating).toFixed(2)}★)</dd>
                <dt>Vehicle</dt><dd>{a.vehicle_model} · {a.plate_no}</dd>
                <dt>Distance</dt><dd>{a.distance_km} km (about {Math.round(a.duration_min)} min)</dd>
                <dt>Surge</dt><dd>{a.surge_multiplier}x</dd>
                <dt>Payment</dt><dd>{a.payment_method} · {a.payment_status}</dd>
              </dl>
              {a.status === 'Matched' && <button className="btn danger block" style={{ marginTop: '1rem' }} onClick={cancel}>Cancel ride</button>}
              {error && <p className="err" role="alert">{error}</p>}
            </section>
          ) : (
            <section className="card">
              <h2>Book a ride</h2>
              <dl className="kv" style={{ marginBottom: '1rem' }}>
                <dt>Pickup</dt><dd>{pickup ? `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}` : 'Not set'}</dd>
                <dt>Drop-off</dt><dd>{dropoff ? `${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)}` : 'Not set'}</dd>
              </dl>
              <label className="field"><span>Pay with</span>
                <select value={payment} onChange={(e) => setPayment(e.target.value)}>{['UPI', 'Card', 'Cash'].map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              {error && <p className="err" role="alert">{error}</p>}
              <button className="btn primary block" disabled={!pickup || !dropoff || busy} onClick={request}>{busy ? 'Finding a driver…' : 'Request ride'}</button>
              {(pickup || dropoff) && <button className="btn small" style={{ marginTop: '.5rem' }} onClick={() => { setPickup(null); setDropoff(null); }}>Clear points</button>}
            </section>
          )}

          <section className="card">
            <h2>Your trips</h2>
            {state.history.length === 0 && <p className="muted">No trips yet. Your first ride will show up here.</p>}
            {state.history.map((t: any) => <HistoryItem key={t.trip_id} t={t} onChange={refresh} />)}
          </section>
        </div>
      </main>
    </>
  );
}
