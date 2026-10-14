export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough city-road estimate: 1.3x straight line, 25 km/h average speed. */
export function estimateTrip(a: LatLng, b: LatLng) {
  const distanceKm = Math.max(0.1, Math.round(haversineKm(a, b) * 1.3 * 100) / 100);
  const durationMin = Math.max(1, Math.round((distanceKm / 25) * 60 * 100) / 100);
  return { distanceKm, durationMin };
}

/** WKT bounding box (SRID 0, lng lat order) of `radiusKm` around a point. Lets MySQL use the SPATIAL INDEX. */
export function bboxWkt(c: LatLng, radiusKm: number): string {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((c.lat * Math.PI) / 180));
  const [x1, y1, x2, y2] = [c.lng - dLng, c.lat - dLat, c.lng + dLng, c.lat + dLat];
  return `POLYGON((${x1} ${y1}, ${x2} ${y1}, ${x2} ${y2}, ${x1} ${y2}, ${x1} ${y1}))`;
}
