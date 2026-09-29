import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Per Phase 11: TypeScript errors must NOT be ignored at build time.
  // Spec §26: "ห้ามลดมาตรฐาน lint/type เพื่อให้ build ผ่าน"
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
