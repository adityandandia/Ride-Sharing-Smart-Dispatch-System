import { handle, requireAuth } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { getLiveLocation } from '@/lib/redis';

export const GET = handle(async () => {
  const s = await requireAuth(['Driver']);
  const me = await q1(
    `SELECT u.name, d.status, d.rating_avg, d.rating_count, v.model, v.plate_no,
            ST_X(d.current_location) AS lng, ST_Y(d.current_location) AS lat
       FROM drivers d JOIN users u ON u.user_id = d.driver_id
       JOIN vehicles v ON v.driver_id = d.driver_id WHERE d.driver_id = ? LIMIT 1`,
    [s.userId]
  );
  const trip = await q1(
    `SELECT t.trip_id, t.status, t.pickup_address, t.dropoff_address, t.distance_km, t.fare, u.name AS rider_name,
            ST_X(t.pickup_location) AS pickup_lng, ST_Y(t.pickup_location) AS pickup_lat,
            ST_X(t.dropoff_location) AS dropoff_lng, ST_Y(t.dropoff_location) AS dropoff_lat
       FROM trips t JOIN users u ON u.user_id = t.rider_id
      WHERE t.driver_id = ? AND t.status IN ('Matched','InProgress') LIMIT 1`,
    [s.userId]
  );
  const completed = await q1(
    "SELECT COUNT(*) AS n, COALESCE(SUM(fare),0) AS earned FROM trips WHERE driver_id = ? AND status = 'Completed'",
    [s.userId]
  );
  // the freshest position comes from Redis; MySQL holds the throttled copy used for matching
  const live = await getLiveLocation(s.userId);
  return { ...me, ...(live ? { lat: live.lat, lng: live.lng } : {}), trip: trip ?? null, completed };
});
