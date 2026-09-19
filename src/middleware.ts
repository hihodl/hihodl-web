import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isAppHost, productOrigin, productPathForCreator } from '@/lib/app/paths';
import { isWalletPath, newNonce, walletCsp } from '@/lib/wallet/csp';

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
type Init = { request: { headers: Headers } } | undefined;

function route(request: NextRequest, init: Init): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host');

  // Files from /public (logos, icons) are the same on both hosts.
  if (/\.[a-z0-9]+$/i.test(pathname)) return null;

  if (isAppHost(host)) {
    // The prefix is an implementation detail; a link that carries it is
    // sent to the address it means.
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      // Leading slashes collapsed to one: `/app//evil.com` would otherwise
      // become `//evil.com`, which `new URL` reads as another host, an open
      // redirect on the domain people sign in on.
      const inner = pathname.slice(4).replace(/^\/{2,}/, '/');
      return NextResponse.redirect(new URL(`${inner || '/'}${search}`, request.url));
    }
    // `/` is the Dashboard: the /app tree's own index.
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/app' : `/app${pathname}`;
    return NextResponse.rewrite(url, init);
  }

  const origin = productOrigin();

  if (pathname === '/creator' || pathname.startsWith('/creator/')) {
    const target = `${productPathForCreator(pathname)}${search}`;
    return NextResponse.redirect(origin ? `${origin}${target}` : new URL(`/app${target}`, request.url));
  }

  // In production the product has its own origin (sessions are per origin),
  // so the /app tree is not served under the website's.
  if (origin && (pathname === '/app' || pathname.startsWith('/app/'))) {
    return NextResponse.redirect(`${origin}${pathname.slice(4).replace(/^\/{2,}/, '/') || '/'}${search}`);
  }

  return null;
}

/**
 * A wallet page gets a fresh nonce and a strict CSP (lib/wallet/csp.ts). The
 * policy goes on the REQUEST too: that is where Next reads the nonce from to
 * stamp it on its own scripts.
 */
function walletInit(request: NextRequest): { init: Init; csp: string | null } {
  if (!isWalletPath(request.nextUrl.pathname)) return { init: undefined, csp: null };
  const csp = walletCsp(newNonce());
  const headers = new Headers(request.headers);
  headers.set('content-security-policy', csp);
  return { init: { request: { headers } }, csp };
}

export function middleware(request: NextRequest) {
  const { init, csp } = walletInit(request);
  const response = route(request, init) ?? NextResponse.next(init);
  if (csp) {
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
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
