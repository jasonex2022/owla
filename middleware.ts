import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;
  
  // Redirect root to /la
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/la', request.url));
  }
  
  // For city paths like /la, /nyc, etc - just serve the app
  if (pathname.match(/^\/[a-z]{2,3}$/)) {
    // Rewrite to root but keep the URL as /la
    return NextResponse.rewrite(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.svg (favicon files)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|.*\\.[a-z]+$).*)',
  ],
};