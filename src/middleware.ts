import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { searchParams } = new URL(request.url);
  const refCode = searchParams.get('ref');

  // Si hay código de referido en la URL, guardarlo en cookie
  if (refCode) {
    response.cookies.set('hihodl_ref', refCode, {
      maxAge: 60 * 60 * 24 * 30, // 30 días
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


