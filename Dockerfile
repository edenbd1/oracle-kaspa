FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Force install ALL deps (tsx/typescript needed at runtime)
ENV NODE_ENV=development
RUN npm ci
ENV NODE_ENV=production

# kaspa-wasm setup (may fail in some environments — anchoring becomes optional)
RUN npm run setup:kaspa || echo "kaspa-wasm setup skipped"

COPY . .

EXPOSE 3000 3001

CMD ["npx", "tsx", "src/server.ts"]
