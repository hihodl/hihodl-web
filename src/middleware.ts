import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Match the nanoid alphabet used in /api/waitlist/join (8 chars, [0-9a-z]).
// Anything else can never match a real referral_code in the DB anyway, so
// reject early to avoid persisting attacker-controlled cookie payloads.
const REFERRAL_CODE_RE = /^[0-9a-z]{8}$/;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { searchParams } = new URL(request.url);
  const refCode = searchParams.get('ref');

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


