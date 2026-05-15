# ─── Express backend ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Application source
COPY server/ .

# Android APK for website download (build after mobile/build-apk.cmd)
COPY public/downloads/banaoo-latest.apk ./downloads/banaoo-latest.apk

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "index.js"]
