import { handle, requireAuth } from '@/lib/auth';
import { q1 } from '@/lib/db';

export const GET = handle(async () => {
  const s = await requireAuth();
  return q1('SELECT user_id, name, email, role FROM users WHERE user_id = ?', [s.userId]);
});
