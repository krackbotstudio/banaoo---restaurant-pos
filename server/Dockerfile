# ─── Express backend ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source (excluding files listed in .dockerignore)
COPY . .

# Create uploads directory; persisted via a Docker volume
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "index.js"]
