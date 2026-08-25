/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        // Keep local browser traffic same-origin. This also works when Next.js
        // chooses a fallback port or the frontend is opened from another device.
        source: "/backend/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ]
  },
}

export default nextConfig
