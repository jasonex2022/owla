import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCityFromUrl, getCityEnvVars } from './lib/config/cities';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;
  
  // Extract city from path (e.g., /la, /nyc)
  const cityMatch = pathname.match(/^\/([a-z]{2,3})(\/.*)?$/);
  
  if (cityMatch) {
    const cityId = cityMatch[1];
    const cityConfig = getCityFromUrl(pathname);
    
    if (cityConfig) {
      // Set city-specific headers that can be read by the app
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-city-id', cityConfig.id);
      requestHeaders.set('x-city-name', cityConfig.name);
      requestHeaders.set('x-city-short', cityConfig.shortName);
      
      // Rewrite to remove city prefix from path
      const newPathname = cityMatch[2] || '/';
      const newUrl = new URL(newPathname, request.url);
      
      // Keep query params
      newUrl.search = url.search;
      
      const response = NextResponse.rewrite(newUrl, {
        request: {
          headers: requestHeaders,
        },
      });
      
      // Set city config in response headers for client
      const cityEnvVars = getCityEnvVars(cityConfig);
      Object.entries(cityEnvVars).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }
  }
  
  // If no city specified, redirect to /la
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/la', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};