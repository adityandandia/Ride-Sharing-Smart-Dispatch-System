import { body, handle, requireAuth } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { pricingSchema } from '@/lib/validators';

export const GET = handle(async () => {
  await requireAuth(['Admin']);
  return q1('SELECT base_fare AS baseFare, per_km AS perKm, per_min AS perMin, min_fare AS minFare, surge_override AS surgeOverride FROM pricing_config WHERE config_id = 1');
});

export const PUT = handle(async (req) => {
  await requireAuth(['Admin']);
  const p = await body(req, pricingSchema);
  await q('UPDATE pricing_config SET base_fare=?, per_km=?, per_min=?, min_fare=?, surge_override=? WHERE config_id = 1', [
    p.baseFare, p.perKm, p.perMin, p.minFare, p.surgeOverride,
  ]);
  return { ok: true };
});
