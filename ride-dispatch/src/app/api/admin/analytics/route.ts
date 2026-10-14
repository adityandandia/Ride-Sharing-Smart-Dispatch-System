import { handle, requireAuth } from '@/lib/auth';
import { q, q1 } from '@/lib/db';

export const GET = handle(async () => {
  await requireAuth(['Admin']);
  const [byStatus, revenue, topDrivers, fleet, complaints, perDay] = await Promise.all([
    q('SELECT status, COUNT(*) AS n FROM trips GROUP BY status'),
    q1("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'Paid'"),
    q(`SELECT u.name, d.rating_avg, d.rating_count, COUNT(t.trip_id) AS trips
         FROM drivers d JOIN users u ON u.user_id = d.driver_id
         LEFT JOIN trips t ON t.driver_id = d.driver_id AND t.status = 'Completed'
        GROUP BY d.driver_id, u.name, d.rating_avg, d.rating_count
        ORDER BY trips DESC, d.rating_avg DESC LIMIT 5`),
    q('SELECT status, COUNT(*) AS n FROM drivers GROUP BY status'),
    q1("SELECT COUNT(*) AS open FROM complaints WHERE status = 'Open'"),
    q(`SELECT DATE(requested_at) AS day, COUNT(*) AS trips, ROUND(SUM(fare), 2) AS gross
         FROM trips WHERE requested_at >= NOW() - INTERVAL 7 DAY GROUP BY DATE(requested_at) ORDER BY day`),
  ]);
  return { byStatus, revenue: revenue?.total ?? 0, topDrivers, fleet, openComplaints: complaints?.open ?? 0, perDay };
});
