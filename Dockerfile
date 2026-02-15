FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Copy everything first (scripts needed for kaspa-wasm setup)
COPY . .

# Force install ALL deps (tsx/typescript needed at runtime)
ENV NODE_ENV=development
RUN npm ci
ENV NODE_ENV=production

# kaspa-wasm setup (needs curl + unzip + scripts/)
RUN npm run setup:kaspa || echo "kaspa-wasm setup skipped"

EXPOSE 3000 3001

CMD ["npx", "tsx", "src/server.ts"]
