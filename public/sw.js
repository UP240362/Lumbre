// SERVICE WORKER DE LUMBRE
// Un pequeño programa que el navegador guarda y que se pone entre la app y
// el internet. Hace una sola cosa: si quieres abrir una página y no hay
// conexión, te lleva a /sin-conexion, donde puedes leer los libros que
// guardaste en el teléfono.
//
// Guarda una copia de /sin-conexion y de los archivos que necesita (código,
// estilos, letras). Esa página no tiene datos de nadie: los libros viven
// en IndexedDB y sus ilustraciones en el almacén "lumbre-imagenes".

const CACHE = "lumbre-sin-conexion";
const PAGINA = "/sin-conexion";
const RECURSO = /\/_next\/static\/[^"'\s)\\]+/g;

// Descarga /sin-conexion y todo lo que usa, y borra copias viejas.
async function guardarPaginaSinConexion() {
  const respuesta = await fetch(PAGINA, { cache: "no-store" });
  if (!respuesta.ok || respuesta.redirected) return;
  const html = await respuesta.clone().text();

  const recursos = new Set(html.match(RECURSO) ?? []);
  recursos.add("/icon.svg");
  const cache = await caches.open(CACHE);

  for (const url of [...recursos]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      // Las hojas de estilo piden las letras (fuentes): también se guardan.
      if (url.endsWith(".css")) {
        const css = await r.clone().text();
        for (const [, crudo] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
          if (crudo.startsWith("data:")) continue;
          const extra = new URL(crudo, new URL(url, self.location.origin)).pathname;
          if (!extra.startsWith("/_next/static/") || recursos.has(extra)) continue;
          recursos.add(extra);
          const f = await fetch(extra).catch(() => null);
          if (f?.ok) await cache.put(extra, f);
        }
      }
      await cache.put(url, r);
    } catch {}
  }
  await cache.put(PAGINA, respuesta);

  // Lo que ya no usa la página nueva (de una versión anterior) se borra.
  for (const pedido of await cache.keys()) {
    const ruta = new URL(pedido.url).pathname;
    if (ruta !== PAGINA && !recursos.has(ruta)) await cache.delete(pedido);
  }
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(guardarPaginaSinConexion().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

// La app pide renovar la copia cada vez que se abre con internet, para
// que la página sin conexión siempre sea la de la versión actual.
self.addEventListener("message", (evento) => {
  if (evento.data === "actualizar") {
    evento.waitUntil(guardarPaginaSinConexion().catch(() => {}));
  }
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // Abrir una página: primero por internet; si no hay, a /sin-conexion.
  if (pedido.mode === "navigate") {
    evento.respondWith(
      fetch(pedido).catch(async () => {
        const copia = await caches.match(PAGINA);
        if (!copia) return Response.error();
        if (url.pathname === PAGINA) return copia;
        const destino = new URL(PAGINA, self.location.origin);
        destino.searchParams.set("desde", url.pathname);
        return Response.redirect(destino.href, 302);
      }),
    );
    return;
  }

  // Ilustraciones y páginas de cómics de los libros guardados (las guarda
  // src/lib/sinConexion.ts):
  // por internet; si no hay, la copia del teléfono.
  if (url.pathname.startsWith("/api/imagen/") || url.pathname.startsWith("/api/archivo/")) {
    evento.respondWith(
      fetch(pedido).catch(async () => {
        const cache = await caches.open("lumbre-imagenes");
        return (await cache.match(pedido)) ?? Response.error();
      }),
    );
    return;
  }

  // Código, estilos y letras: por internet; si no hay, la copia guardada.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    evento.respondWith(
      fetch(pedido).catch(async () => (await caches.match(pedido)) ?? Response.error()),
    );
  }
});
