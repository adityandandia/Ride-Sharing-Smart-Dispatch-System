import bcrypt from 'bcryptjs';
import { body, handle, createSession, HttpError, Role } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { loginSchema } from '@/lib/validators';

export const POST = handle(async (req) => {
  const { email, password } = await body(req, loginSchema);
  const user = await q1<{ user_id: number; password_hash: string; role: Role }>(
    'SELECT user_id, password_hash, role FROM users WHERE email = ?',
    [email]
  );
  // same message for unknown email and wrong password
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new HttpError(401, 'Email or password is incorrect');
  await createSession(user.user_id, user.role);
  return { ok: true, role: user.role };
});
