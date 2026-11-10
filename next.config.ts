import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Oculta el círculo "N" que Next.js muestra en pantalla mientras se
  // desarrolla. Los errores se siguen mostrando cuando los hay.
  devIndicators: false,
  cacheComponents: true,
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
