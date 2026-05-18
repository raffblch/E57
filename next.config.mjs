/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large request bodies for E57 uploads (Next 15+ caps API body size by default).
  experimental: {
    serverActions: {
      bodySizeLimit: '10gb',
    },
  },
  async headers() {
    return [
      {
        source: '/pointclouds/:path*',
        headers: [{ key: 'Accept-Ranges', value: 'bytes' }],
      },
    ];
  },
};

export default nextConfig;
