import { body, handle, HttpError, requireAuth } from '@/lib/auth';
import { pool, q } from '@/lib/db';
import { bboxWkt, estimateTrip } from '@/lib/geo';
import { getLiveLocation } from '@/lib/redis';
import { rideRequestSchema } from '@/lib/validators';

const SEARCH_RADIUS_KM = 6;

/** Rider's active trip (with the driver's live position from Redis) and history. */
export const GET = handle(async () => {
  const s = await requireAuth(['Rider']);
  const trips = await q(
    `SELECT t.trip_id, t.status, t.pickup_address, t.dropoff_address, t.distance_km, t.duration_min,
            t.surge_multiplier, t.fare, t.requested_at, t.completed_at,
            ST_X(t.pickup_location) AS pickup_lng, ST_Y(t.pickup_location) AS pickup_lat,
            ST_X(t.dropoff_location) AS dropoff_lng, ST_Y(t.dropoff_location) AS dropoff_lat,
            t.driver_id, u.name AS driver_name, d.rating_avg AS driver_rating,
            v.model AS vehicle_model, v.plate_no, p.status AS payment_status, p.method AS payment_method,
            (r.review_id IS NOT NULL) AS reviewed
       FROM trips t
       LEFT JOIN users u ON u.user_id = t.driver_id
       LEFT JOIN drivers d ON d.driver_id = t.driver_id
       LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
       LEFT JOIN payments p ON p.trip_id = t.trip_id
       LEFT JOIN reviews r ON r.trip_id = t.trip_id
      WHERE t.rider_id = ?
      ORDER BY t.trip_id DESC LIMIT 30`,
    [s.userId]
  );
  const active = trips.find((t: any) => t.status === 'Matched' || t.status === 'InProgress') ?? null;
  const driverLocation = active ? await getLiveLocation(active.driver_id) : null;
  return { active, driverLocation, history: trips.filter((t: any) => t !== active) };
});

/**
 * Request a ride. One ACID transaction: find the nearest available driver with a row lock,
 * price the trip, insert it (a trigger flips the driver to Busy), create the payment.
 * SKIP LOCKED means two riders requesting at the same moment can never get the same driver.
 */
export const POST = handle(async (req) => {
  const s = await requireAuth(['Rider']);
  const d = await body(req, rideRequestSchema);
  const { distanceKm, durationMin } = estimateTrip(d.pickup, d.dropoff);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [busy]: any = await conn.query(
      "SELECT trip_id FROM trips WHERE rider_id = ? AND status IN ('Matched','InProgress') LIMIT 1",
      [s.userId]
    );
    if (busy.length) throw new HttpError(409, 'You already have a trip in progress');

    // Spatial KNN: MBRContains uses the SPATIAL INDEX to shortlist, ST_Distance_Sphere ranks.
    const [found]: any = await conn.query(
      `SELECT d.driver_id, v.vehicle_id,
              ST_Distance_Sphere(d.current_location, POINT(?, ?)) AS dist_m
         FROM drivers d
         JOIN vehicles v ON v.driver_id = d.driver_id
        WHERE d.status = 'Available'
          AND MBRContains(ST_GeomFromText(?), d.current_location)
        ORDER BY dist_m
        LIMIT 1
          FOR UPDATE OF d SKIP LOCKED`,
      [d.pickup.lng, d.pickup.lat, bboxWkt(d.pickup, SEARCH_RADIUS_KM)]
    );
    if (!found.length) throw new HttpError(404, 'No drivers are available near this pickup right now');
    const driver = found[0];

    await conn.query('CALL compute_surge(@surge)');
    await conn.query('CALL calculate_fare(?, ?, @surge, @fare)', [distanceKm, durationMin]);
    const [[price]]: any = await conn.query('SELECT @surge AS surge, @fare AS fare');

    const [ins]: any = await conn.query(
      `INSERT INTO trips (rider_id, driver_id, vehicle_id, pickup_location, dropoff_location,
                          pickup_address, dropoff_address, status, distance_km, duration_min, surge_multiplier, fare)
       VALUES (?, ?, ?, POINT(?, ?), POINT(?, ?), ?, ?, 'Matched', ?, ?, ?, ?)`,
      [s.userId, driver.driver_id, driver.vehicle_id, d.pickup.lng, d.pickup.lat, d.dropoff.lng, d.dropoff.lat,
       d.pickupAddress ?? null, d.dropoffAddress ?? null, distanceKm, durationMin, Number(price.surge), Number(price.fare)]
    );
    await conn.query('INSERT INTO payments (trip_id, amount, method, status) VALUES (?,?,?,?)', [
      ins.insertId, Number(price.fare), d.paymentMethod, 'Pending',
    ]);

    await conn.commit();
    return { tripId: ins.insertId, fare: Number(price.fare), surge: Number(price.surge), driverDistanceM: Math.round(driver.dist_m) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});
