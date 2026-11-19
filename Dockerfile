FROM node:22-slim

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install dependencies cleanly (avoid peer dependency resolution conflicts)
RUN npm install --legacy-peer-deps

# Copy full application source
COPY . .

# Build Vite production frontend into /app/dist
RUN npm run build

# Ensure runtime persistence folder (.data for server ledger & WhatsApp session) is writable
RUN mkdir -p /app/.data && chmod -R 777 /app/.data

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

# Start full-stack Express + production static server directly
CMD ["node", "server.ts"]

