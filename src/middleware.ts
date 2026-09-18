import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isAppHost, productOrigin, productPathForCreator } from '@/lib/app/paths';

// Match the nanoid alphabet used in /api/waitlist/join (8 chars, [0-9a-z]).
// Anything else can never match a real referral_code in the DB anyway, so
// reject early to avoid persisting attacker-controlled cookie payloads.
const REFERRAL_CODE_RE = /^[0-9a-z]{8}$/;

/**
 * Two sites on one deploy.
 *
 * `app.hihodl.xyz` (and `app.localhost` in dev) is the logged-in product: its
 * paths are the `/app` tree of this app, rewritten so the address bar never
 * shows the prefix. Everything else is the website, where the old creator
 * console's `/creator/*` addresses now send people into the product.
 */
function route(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host');

  // Files from /public (logos, icons) are the same on both hosts.
  if (/\.[a-z0-9]+$/i.test(pathname)) return null;

  if (isAppHost(host)) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL(`/spaces${search}`, request.url));
    }
    // The prefix is an implementation detail; a link that carries it is
    // sent to the address it means.
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return NextResponse.redirect(new URL(`${pathname.slice(4) || '/spaces'}${search}`, request.url));
    }
    const url = request.nextUrl.clone();
    url.pathname = `/app${pathname}`;
    return NextResponse.rewrite(url);
  }

  const origin = productOrigin();

  if (pathname === '/creator' || pathname.startsWith('/creator/')) {
    const target = `${productPathForCreator(pathname)}${search}`;
    return NextResponse.redirect(origin ? `${origin}${target}` : new URL(`/app${target}`, request.url));
  }

  // In production the product has its own origin (sessions are per origin),
  // so the /app tree is not served under the website's.
  if (origin && (pathname === '/app' || pathname.startsWith('/app/'))) {
    return NextResponse.redirect(`${origin}${pathname.slice(4) || '/spaces'}${search}`);
  }

  return null;
}

export function middleware(request: NextRequest) {
  const response = route(request) ?? NextResponse.next();
  const refCode = request.nextUrl.searchParams.get('ref');

  // Only persist the cookie if the ref code matches our nanoid format.
  // Previously we wrote `?ref=<anything>` verbatim, including unbounded-
  // length / non-ASCII / control-character payloads — a free cookie-bomb
  // surface. Strict format check + 30-day TTL.
  if (refCode && REFERRAL_CODE_RE.test(refCode)) {
    response.cookies.set('hihodl_ref', refCode, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
