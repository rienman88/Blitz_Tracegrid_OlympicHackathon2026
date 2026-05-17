/** @type {import('next').NextConfig} */
const internalApiBaseUrl = process.env.INTERNAL_API_BASE_URL || "http://backend:8000";

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: __dirname
  },
  async rewrites() {
    return [
      { source: "/health", destination: `${internalApiBaseUrl}/health` },
      { source: "/analyze", destination: `${internalApiBaseUrl}/analyze` },
      { source: "/execute", destination: `${internalApiBaseUrl}/execute` },
      { source: "/agents", destination: `${internalApiBaseUrl}/agents` },
      { source: "/voice", destination: `${internalApiBaseUrl}/voice` },
      { source: "/voice/status", destination: `${internalApiBaseUrl}/voice/status` }
    ];
  }
};

module.exports = nextConfig;
