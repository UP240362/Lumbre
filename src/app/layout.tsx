import type { Metadata, Viewport } from "next";
import { Inter, Literata } from "next/font/google";
import { SCRIPT_PREFERENCIAS } from "@/lib/luz";
import "./globals.css";

// Tipografías: Inter para la interfaz, Literata para títulos y lectura.
// next/font las descarga al compilar y las sirve desde nuestro propio sitio.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Lumbre",
  description:
    "Lee libros de dominio público, guarda tus favoritos y tu avance en cada libro.",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
};

// Layout raíz: envuelve a TODAS las páginas del sitio.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${literata.variable} h-full antialiased`}
      // El script de abajo cambia <html> antes de que React arranque;
      // esto evita una advertencia por esa diferencia.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PREFERENCIAS }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
