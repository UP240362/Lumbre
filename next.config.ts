import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Oculta el círculo "N" que Next.js muestra en pantalla mientras se
  // desarrolla. Los errores se siguen mostrando cuando los hay.
  devIndicators: false,
  // Al construir, junta en .next/standalone solo lo necesario para correr
  // el sitio. Así la imagen de Docker queda mucho más chica.
  output: "standalone",
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
