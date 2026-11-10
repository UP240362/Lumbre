import type { MetadataRoute } from "next";

// MANIFIESTO: le dice al teléfono que Lumbre se puede instalar como app
// (nombre, ícono, colores y que se abra sin la barra del navegador).
// Next.js lo sirve en /manifest.webmanifest solo por llamarse así.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumbre",
    short_name: "Lumbre",
    description:
      "Lee libros de dominio público, guarda tus favoritos y tu avance en cada libro.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B0B",
    theme_color: "#0B0B0B",
    categories: ["books", "education"],
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      {
        // "maskable": versión con margen para que Android la recorte
        // en círculo o en la forma que use el teléfono.
        src: "/iconos/icono-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
