/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "pub-c1c242c15972c98b84e9d48c43d1127f.r2.dev",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevent Vercel from issuing redirects that break /_next/data routes
  skipTrailingSlashRedirect: true,
  // Suppress the Suspense CSR bailout that causes 500s on dynamic client pages
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://il-production.up.railway.app"
        : "http://127.0.0.1:4000");
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
