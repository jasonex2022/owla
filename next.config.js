/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Disable image optimization for easier deployment
  images: {
    unoptimized: true,
  },
  
  // Environment variables that are safe to expose to the client
  env: {
    NEXT_PUBLIC_CITY_NAME: process.env.NEXT_PUBLIC_CITY_NAME || 'Los Angeles',
    NEXT_PUBLIC_CITY_SHORT: process.env.NEXT_PUBLIC_CITY_SHORT || 'LA',
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig