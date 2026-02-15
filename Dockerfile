FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

RUN npm ci

# kaspa-wasm setup (may fail in some environments — anchoring becomes optional)
RUN npm run setup:kaspa || echo "kaspa-wasm setup skipped"

COPY . .

EXPOSE 3000 3001

CMD ["npx", "tsx", "src/server.ts"]
