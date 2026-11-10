# IMAGEN DE DOCKER DE LUMBRE
# Se arma en tres etapas para que la imagen final sea chica:
#   1. dependencias: instala los paquetes de npm.
#   2. construccion: compila el sitio con "next build".
#   3. final: solo copia lo necesario para correrlo.

FROM node:24.22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ── 1. Dependencias ──────────────────────────────────────────────────
FROM base AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. Construcción ──────────────────────────────────────────────────
FROM base AS construccion
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
# Las variables NEXT_PUBLIC_ se escriben dentro del código al compilar,
# así que se necesitan aquí. Llegan desde docker-compose.yml.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# La carpeta public puede estar vacía (git no guarda carpetas vacías).
RUN mkdir -p public && npm run build

# ── 3. Imagen final ──────────────────────────────────────────────────
FROM base AS final
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# El sitio corre con un usuario sin permisos de administrador.
# /app/datos guarda el conteo de cuentas por IP (es un volumen de Docker).
RUN addgroup -S lumbre && adduser -S lumbre -G lumbre \
    && mkdir -p /app/datos && chown lumbre:lumbre /app/datos
ENV LUMBRE_DATOS=/app/datos
COPY --from=construccion /app/public ./public
COPY --from=construccion --chown=lumbre:lumbre /app/.next/standalone ./
COPY --from=construccion --chown=lumbre:lumbre /app/.next/static ./.next/static
USER lumbre
EXPOSE 3000
CMD ["node", "server.js"]
