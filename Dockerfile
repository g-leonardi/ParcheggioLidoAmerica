# Build del client + runtime del server in un'unica immagine.
# node:sqlite è integrato nel runtime Node (niente dipendenze native da compilare).

# --- Stage 1: build ---
FROM node:26-slim AS build
WORKDIR /app
# Dipendenze del server (cache layer)
COPY package*.json ./
RUN npm ci
# Sorgenti + build del client (Vite → client/dist)
COPY . .
RUN npm --prefix client install && npm --prefix client run build

# --- Stage 2: runtime ---
FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/package.json ./
# /data è il volume persistente (DB SQLite); DB_PATH lo punta lì via fly.toml.
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
