import { body, handle, requireAuth } from '@/lib/auth';
import { q } from '@/lib/db';
import { searchComplaints } from '@/lib/vector';
import { disputeSearchSchema } from '@/lib/validators';

/** Semantic (cosine) search over complaints, then joined back to the relational data. */
export const POST = handle(async (req) => {
  await requireAuth(['Admin']);
  const { query } = await body(req, disputeSearchSchema);
  const hits = await searchComplaints(query, 5);
  if (!hits.length) return { results: [] };
  const rows = await q(
    `SELECT c.complaint_id, c.trip_id, c.description, c.status, c.created_at, u.name AS rider_name, t.fare, t.surge_multiplier, d.name AS driver_name
       FROM complaints c JOIN users u ON u.user_id = c.rider_id
       JOIN trips t ON t.trip_id = c.trip_id LEFT JOIN users d ON d.user_id = t.driver_id
      WHERE c.complaint_id IN (?)`,
    [hits.map((h) => h.id)]
  );
  const results = hits
    .map((h) => ({ ...rows.find((r: any) => r.complaint_id === h.id), similarity: h.similarity }))
    .filter((r: any) => r.complaint_id);
  return { results };
});
