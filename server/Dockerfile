# ─── Express backend ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Application source (includes server/downloads if present)
COPY . .

RUN mkdir -p uploads downloads

EXPOSE 5000

CMD ["node", "index.js"]
