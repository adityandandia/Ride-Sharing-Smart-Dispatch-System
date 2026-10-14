import { body, handle, requireAuth } from '@/lib/auth';
import { q } from '@/lib/db';
import { driverLocKey, redis } from '@/lib/redis';
import { locationSchema } from '@/lib/validators';

/**
 * High-frequency GPS pings go to Redis (driver:loc:<id>, 2 min TTL).
 * MySQL's spatial column is refreshed at most every 15 s per driver, so the
 * SPATIAL INDEX stays current for matching without a write per ping.
 */
export const POST = handle(async (req) => {
  const s = await requireAuth(['Driver']);
  const { lat, lng } = await body(req, locationSchema);
  await redis.set(driverLocKey(s.userId), JSON.stringify({ lat, lng, ts: Date.now() }), 'EX', 120);
  const mayWrite = await redis.set(`driver:sync:${s.userId}`, '1', 'EX', 15, 'NX');
  if (mayWrite === 'OK') {
    await q('UPDATE drivers SET current_location = POINT(?, ?), location_updated_at = NOW() WHERE driver_id = ?', [lng, lat, s.userId]);
  }
  return { ok: true, persisted: mayWrite === 'OK' };
});
