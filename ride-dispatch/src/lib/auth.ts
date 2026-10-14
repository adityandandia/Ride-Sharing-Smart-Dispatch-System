import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { redis, sessionKey } from './redis';

export type Role = 'Rider' | 'Driver' | 'Admin';
export type Session = { userId: number; role: Role; jti: string };

const SESSION_TTL = 8 * 60 * 60; // seconds
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? '');

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Sessions live in Redis (revocable); the JWT cookie only carries the session id. */
export async function createSession(userId: number, role: Role) {
  const jti = randomUUID();
  await redis.set(sessionKey(jti), JSON.stringify({ userId, role }), 'EX', SESSION_TTL);
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setJti(jti)
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret());
  cookies().set('token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get('token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const jti = payload.jti as string;
    const stored = await redis.get(sessionKey(jti));
    if (!stored) return null;
    const { userId, role } = JSON.parse(stored);
    return { userId, role, jti };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const s = await getSession();
  if (s) await redis.del(sessionKey(s.jti));
  cookies().delete('token');
}

/** RBAC gate used at the top of every protected route handler. */
export async function requireAuth(roles?: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Please sign in');
  if (roles && !roles.includes(s.role)) throw new HttpError(403, 'You do not have access to this action');
  return s;
}

export async function body<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
  return schema.parse(json);
}

type Ctx = { params?: Record<string, string> };
/** Wraps a route handler: JSON responses plus uniform error handling. */
export function handle<C = Ctx>(fn: (req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return NextResponse.json({ error: `${first.path.join('.') || 'input'}: ${first.message}` }, { status: 400 });
      }
      if ((e as any)?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'That value is already registered' }, { status: 409 });
      console.error(e);
      return NextResponse.json({ error: 'Something went wrong on the server' }, { status: 500 });
    }
  };
}
