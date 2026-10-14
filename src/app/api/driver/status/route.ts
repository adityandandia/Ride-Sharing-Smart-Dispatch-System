import { body, handle, HttpError, requireAuth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { driverStatusSchema } from '@/lib/validators';

export const POST = handle(async (req) => {
  const s = await requireAuth(['Driver']);
  const { status } = await body(req, driverStatusSchema);
  // never overwrite 'Busy': that state belongs to the trip trigger
  const [res]: any = await pool.query("UPDATE drivers SET status = ? WHERE driver_id = ? AND status <> 'Busy'", [status, s.userId]);
  if (!res.affectedRows) throw new HttpError(409, 'Finish your current trip before changing availability');
  return { ok: true };
});
