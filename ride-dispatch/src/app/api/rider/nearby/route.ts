import { handle, requireAuth } from '@/lib/auth';
import { q } from '@/lib/db';
import { bboxWkt } from '@/lib/geo';

/** Available drivers within 6 km of ?lat&lng, shown as dots on the rider's map. */
export const GET = handle(async (req) => {
  await requireAuth(['Rider']);
  const lat = Number(req.nextUrl.searchParams.get('lat') ?? 12.9716);
  const lng = Number(req.nextUrl.searchParams.get('lng') ?? 77.5946);
  return q(
    `SELECT d.driver_id, ST_X(d.current_location) AS lng, ST_Y(d.current_location) AS lat,
            ST_Distance_Sphere(d.current_location, POINT(?, ?)) AS dist_m
       FROM drivers d
      WHERE d.status = 'Available' AND MBRContains(ST_GeomFromText(?), d.current_location)
      ORDER BY dist_m LIMIT 20`,
    [lng, lat, bboxWkt({ lat, lng }, 6)]
  );
});
