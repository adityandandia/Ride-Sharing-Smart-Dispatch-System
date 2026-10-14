import { body, handle, HttpError, requireAuth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { tripActionSchema } from '@/lib/validators';

/** Rider cancels a trip that has not started yet. The trigger frees the driver. */
export const POST = handle<{ params: { id: string } }>(async (req, ctx) => {
  const s = await requireAuth(['Rider']);
  const { action } = await body(req, tripActionSchema);
  if (action !== 'cancel') throw new HttpError(400, 'Riders can only cancel trips');
  const tripId = Number(ctx.params.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows]: any = await conn.query('SELECT status FROM trips WHERE trip_id = ? AND rider_id = ? FOR UPDATE', [tripId, s.userId]);
    if (!rows.length) throw new HttpError(404, 'Trip not found');
    if (rows[0].status !== 'Matched') throw new HttpError(409, 'Only a trip that has not started can be cancelled');
    await conn.query("UPDATE trips SET status = 'Cancelled' WHERE trip_id = ?", [tripId]);
    await conn.query("UPDATE payments SET status = 'Failed' WHERE trip_id = ?", [tripId]);
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});
