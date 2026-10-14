import { body, handle, HttpError, requireAuth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { tripActionSchema } from '@/lib/validators';

/** Driver starts or completes a trip. Completing marks payment Paid; the trigger frees the driver. */
export const POST = handle<{ params: { id: string } }>(async (req, ctx) => {
  const s = await requireAuth(['Driver']);
  const { action } = await body(req, tripActionSchema);
  if (action === 'cancel') throw new HttpError(400, 'Only riders can cancel a trip');
  const tripId = Number(ctx.params.id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows]: any = await conn.query('SELECT status FROM trips WHERE trip_id = ? AND driver_id = ? FOR UPDATE', [tripId, s.userId]);
    if (!rows.length) throw new HttpError(404, 'Trip not found');
    const status = rows[0].status;
    if (action === 'start') {
      if (status !== 'Matched') throw new HttpError(409, 'This trip cannot be started');
      await conn.query("UPDATE trips SET status = 'InProgress', started_at = NOW() WHERE trip_id = ?", [tripId]);
    } else {
      if (status !== 'InProgress') throw new HttpError(409, 'Start the trip before completing it');
      await conn.query("UPDATE trips SET status = 'Completed', completed_at = NOW() WHERE trip_id = ?", [tripId]);
      await conn.query("UPDATE payments SET status = 'Paid', paid_at = NOW() WHERE trip_id = ?", [tripId]);
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});
