"use client";

// No dibuja nada. En cada página:
// 1. Instala el service worker (public/sw.js), que lleva a /sin-conexion
//    cuando no hay internet.
// 2. Le pide renovar su copia de /sin-conexion (una vez por visita).
// 3. Sube a tu cuenta lo que leíste sin internet, al cargar la página y
//    cada vez que vuelve la conexión.

import { useEffect } from "react";
import { guardarAvance } from "@/app/leer/acciones";
import { subirPendientes } from "@/lib/sinConexion";

export function ServicioSinConexion() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(async () => {
          if (!navigator.onLine) return;
          try {
            if (sessionStorage.getItem("lumbre-sw-al-dia")) return;
            sessionStorage.setItem("lumbre-sw-al-dia", "1");
          } catch {}
          const listo = await navigator.serviceWorker.ready;
          listo.active?.postMessage("actualizar");
        })
        .catch(() => {});
    }

    // En las páginas de acceso no hay sesión: no tiene caso intentar.
    const conSesion = () =>
      !["/login", "/crear-cuenta", "/recuperar", "/sin-conexion"].includes(
        location.pathname,
      );
    const subir = () => {
      if (navigator.onLine && conSesion()) {
        void subirPendientes(guardarAvance).catch(() => {});
      }
    };
    subir();
    window.addEventListener("online", subir);
    return () => window.removeEventListener("online", subir);
  }, []);

  return null;
}
