/** @type {import('next').NextConfig} */

// For Railway: single port serves both Oracle + PM APIs
// For local dev: defaults to localhost:3000 (run src/server.ts for combined, or individual servers)
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/pm/:path*',
        destination: `${backendUrl}/pm/:path*`,
      },
      {
        source: '/api/oracle/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
