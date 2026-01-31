/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/pm/:path*',
        destination: 'http://localhost:3001/pm/:path*',
      },
      {
        source: '/api/oracle/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ];
  },
};

export default nextConfig;
