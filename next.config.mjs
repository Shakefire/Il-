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
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";
    return {
      // beforeFiles: runs BEFORE Next.js checks its own file system.
      // This means ALL /api/* requests proxy to Railway first,
      // before any Next.js route handlers can intercept them.
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
