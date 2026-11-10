import type { Metadata } from "next";
import { PantallaSinConexion } from "./PantallaSinConexion";

// PÁGINA SIN CONEXIÓN: /sin-conexion
// El service worker (public/sw.js) guarda una copia de esta página y te
// trae aquí cuando no hay internet. No pide datos al servidor: todo lo
// lee de los libros guardados en el teléfono.

export const metadata: Metadata = {
  title: "Sin conexión · Lumbre",
};

export default function PaginaSinConexion() {
  return <PantallaSinConexion />;
}
