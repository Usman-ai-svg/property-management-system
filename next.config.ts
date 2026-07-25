import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma Client tidak boleh di-bundle oleh Turbopack/webpack di sisi server.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
