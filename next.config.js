/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverActions: { bodySizeLimit: "1mb" } }
};
module.exports = nextConfig;
