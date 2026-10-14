'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import { api, inr } from '@/lib/api';
import type { MapMarker } from '@/components/GeoMap';

const GeoMap = dynamic(() => import('@/components/GeoMap'), { ssr: false });

export default function DriverPage() {
  const [me, setMe] = useState<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gps, setGps] = useState(false);
  const [error, setError] = useState('');
  const posRef = useRef(pos);
  posRef.current = pos;

  const refresh = useCallback(async () => {
    try {
      const d = await api('/api/driver/me');
      setMe(d);
      setPos((p) => p ?? { lat: d.lat, lng: d.lng });
    } catch {}
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 4000); return () => clearInterval(id); }, [refresh]);

  const send = useCallback(async (p: { lat: number; lng: number }) => {
    try { await api('/api/driver/location', { body: p }); } catch {}
  }, []);

  // keep the Redis key alive and the rider's map moving even when the position is unchanged
  useEffect(() => {
    const id = setInterval(() => posRef.current && send(posRef.current), 8000);
    return () => clearInterval(id);
  }, [send]);

  useEffect(() => {
    if (!gps || !navigator.geolocation) return;
    const w = navigator.geolocation.watchPosition(
      (g) => { const p = { lat: g.coords.latitude, lng: g.coords.longitude }; setPos(p); send(p); },
      () => { setError('Could not read your GPS position. Tap the map to place yourself instead.'); setGps(false); },
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(w);
  }, [gps, send]);

  function place(lat: number, lng: number) {
    if (gps) return;
    const p = { lat, lng };
    setPos(p); send(p);
  }
  async function setStatus(status: 'Available' | 'Offline') {
    setError('');
    try { if (pos) await send(pos); await api('/api/driver/status', { body: { status } }); await refresh(); }
    catch (e: any) { setError(e.message); }
  }
  async function act(action: 'start' | 'complete') {
    setError('');
    try { await api(`/api/driver/trips/${me.trip.trip_id}`, { body: { action } }); await refresh(); }
    catch (e: any) { setError(e.message); }
  }

  const trip = me?.trip;
  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (pos) m.push({ ...pos, color: '#FFB000', label: 'You', radius: 11 });
    if (trip) {
      m.push({ lat: trip.pickup_lat, lng: trip.pickup_lng, color: '#0B7A75', label: 'Pickup' });
      m.push({ lat: trip.dropoff_lat, lng: trip.dropoff_lng, color: '#B83A1B', label: 'Drop-off' });
    }
    return m;
  }, [pos, trip]);

  if (!me) return <><TopBar /><main className="page"><p className="muted">Loading your driver profile…</p></main></>;

  return (
    <>
      <TopBar />
      <main className="page grid">
        <div className="stack">
          <h1>{me.status === 'Offline' ? 'You are offline' : trip ? 'On a trip' : 'Waiting for a rider'}</h1>
          <GeoMap markers={markers} onClick={place} height={460} />
          <div className="row">
            <button className="btn" onClick={() => setGps(!gps)}>{gps ? 'Stop using GPS' : 'Use my GPS'}</button>
            <p className="muted" style={{ flex: 3 }}>Without GPS, tap the map to move yourself. Pings go to Redis every few seconds; MySQL's spatial index is refreshed about every 15 s.</p>
          </div>
        </div>

        <div className="stack">
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>{me.name}</h2><span className={`pill ${me.status}`}>{me.status}</span>
            </div>
            <dl className="kv">
              <dt>Vehicle</dt><dd>{me.model} · {me.plate_no}</dd>
              <dt>Rating</dt><dd>{Number(me.rating_avg).toFixed(2)}★ from {me.rating_count} reviews</dd>
              <dt>Completed trips</dt><dd>{me.completed.n}</dd>
              <dt>Earned</dt><dd>{inr(me.completed.earned)}</dd>
            </dl>
            {me.status !== 'Busy' && (
              <button className={`btn block ${me.status === 'Offline' ? 'primary' : ''}`} style={{ marginTop: '1rem' }} onClick={() => setStatus(me.status === 'Offline' ? 'Available' : 'Offline')}>
                {me.status === 'Offline' ? 'Go online' : 'Go offline'}
              </button>
            )}
            {error && <p className="err" role="alert">{error}</p>}
          </section>

          {trip && (
            <section className="card" aria-live="polite">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2>Trip #{trip.trip_id}</h2><span className={`pill ${trip.status}`}>{trip.status}</span>
              </div>
              <p className="fare">{inr(trip.fare)}</p>
              <dl className="kv"><dt>Rider</dt><dd>{trip.rider_name}</dd><dt>Distance</dt><dd>{trip.distance_km} km</dd></dl>
              {trip.status === 'Matched'
                ? <button className="btn primary block" style={{ marginTop: '1rem' }} onClick={() => act('start')}>Start trip</button>
                : <button className="btn primary block" style={{ marginTop: '1rem' }} onClick={() => act('complete')}>Complete trip and collect payment</button>}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
