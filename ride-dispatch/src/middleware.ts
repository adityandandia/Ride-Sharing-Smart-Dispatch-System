import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const HOME: Record<string, string> = { Rider: '/rider', Driver: '/driver', Admin: '/admin' };

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get('token')?.value;
  let role: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET ?? ''));
      role = payload.role as string;
    } catch {
      /* expired or tampered: treated as signed out */
    }
  }
  const section = ['rider', 'driver', 'admin'].find((s) => path === '/' + s || path.startsWith('/' + s + '/'));
  if (section) {
    if (!role) return NextResponse.redirect(new URL('/login', req.url));
    if (HOME[role] !== '/' + section) return NextResponse.redirect(new URL(HOME[role], req.url));
  }
  if ((path === '/login' || path === '/register') && role) return NextResponse.redirect(new URL(HOME[role], req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/rider/:path*', '/driver/:path*', '/admin/:path*', '/login', '/register'] };
