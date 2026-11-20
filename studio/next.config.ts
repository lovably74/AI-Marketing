import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // pdfkit은 내장 AFM 등 데이터 파일을 __dirname 기준으로 읽으므로 번들하지 않는다
  serverExternalPackages: ["pdfkit"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
