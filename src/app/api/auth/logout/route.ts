import { destroySession, handle } from '@/lib/auth';

export const POST = handle(async () => {
  await destroySession();
  return { ok: true };
});
