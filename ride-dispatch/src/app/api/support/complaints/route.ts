import { body, handle, HttpError, requireAuth } from '@/lib/auth';
import { pool, q, q1 } from '@/lib/db';
import { upsertComplaints } from '@/lib/vector';
import { complaintSchema } from '@/lib/validators';

export const GET = handle(async () => {
  const s = await requireAuth(['Rider']);
  return q('SELECT complaint_id, trip_id, description, status, resolution, created_at FROM complaints WHERE rider_id = ? ORDER BY complaint_id DESC', [s.userId]);
});

export const POST = handle(async (req) => {
  const s = await requireAuth(['Rider']);
  const d = await body(req, complaintSchema);
  const trip = await q1("SELECT trip_id FROM trips WHERE trip_id = ? AND rider_id = ? AND status = 'Completed'", [d.tripId, s.userId]);
  if (!trip) throw new HttpError(404, 'You can only report a problem on your own completed trips');
  const [res]: any = await pool.query('INSERT INTO complaints (trip_id, rider_id, description) VALUES (?,?,?)', [d.tripId, s.userId, d.description]);
  // the complaint is saved even if the vector store is down; admin can re-index later
  let indexed = true;
  try {
    await upsertComplaints([{ id: res.insertId, text: d.description, tripId: d.tripId }]);
  } catch (e) {
    console.error('Chroma upsert failed', e);
    indexed = false;
  }
  return { complaintId: res.insertId, indexed };
});
