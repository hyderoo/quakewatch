import type { NextConfig } from "next";

// GitHub Pages preview builds set NEXT_BASE_PATH=/quakewatch; Vercel and local dev use "".
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
};

export default nextConfig;
