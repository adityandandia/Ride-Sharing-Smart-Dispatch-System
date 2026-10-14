import { handle, requireAuth } from '@/lib/auth';
import { q } from '@/lib/db';
import { upsertComplaints } from '@/lib/vector';

/** Embeds every complaint in MySQL into ChromaDB (run once after seeding). */
export const POST = handle(async () => {
  await requireAuth(['Admin']);
  const rows = await q<{ complaint_id: number; trip_id: number; description: string }>('SELECT complaint_id, trip_id, description FROM complaints');
  await upsertComplaints(rows.map((r) => ({ id: r.complaint_id, text: r.description, tripId: r.trip_id })));
  return { indexed: rows.length };
});
