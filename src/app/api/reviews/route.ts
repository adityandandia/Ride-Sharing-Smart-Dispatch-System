import { body, handle, HttpError, requireAuth } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { reviewSchema } from '@/lib/validators';

/** Inserting a review fires trg_reviews_after_insert, which recalculates the driver's rating. */
export const POST = handle(async (req) => {
  const s = await requireAuth(['Rider']);
  const d = await body(req, reviewSchema);
  const trip = await q1("SELECT trip_id FROM trips WHERE trip_id = ? AND rider_id = ? AND status = 'Completed'", [d.tripId, s.userId]);
  if (!trip) throw new HttpError(404, 'You can only review your own completed trips');
  await q('INSERT INTO reviews (trip_id, rider_id, rating, comment) VALUES (?,?,?,?)', [d.tripId, s.userId, d.rating, d.comment ?? null]);
  return { ok: true };
});
