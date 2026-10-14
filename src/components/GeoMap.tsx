'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapMarker = { lat: number; lng: number; color: string; label?: string; radius?: number };

export default function GeoMap({
  markers,
  onClick,
  height = 420,
}: {
  markers: MapMarker[];
  onClick?: (lat: number, lng: number) => void;
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current).setView([12.9716, 77.5946], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    markers.forEach((mk) => {
      const c = L.circleMarker([mk.lat, mk.lng], { radius: mk.radius ?? 9, color: '#0E2233', weight: 2, fillColor: mk.color, fillOpacity: 0.95 });
      if (mk.label) c.bindTooltip(mk.label);
      c.addTo(g);
    });
  }, [markers]);

  return <div className="map-wrap"><div ref={el} style={{ height }} role="application" aria-label="Map" /></div>;
}
