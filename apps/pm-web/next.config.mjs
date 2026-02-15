/** @type {import('next').NextConfig} */

const backendUrl = process.env.BACKEND_URL || 'http://localhost';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/pm/:path*',
        destination: `${backendUrl}:3001/pm/:path*`,
      },
      {
        source: '/api/oracle/:path*',
        destination: `${backendUrl}:3000/:path*`,
      },
    ];
  },
};

export default nextConfig;
