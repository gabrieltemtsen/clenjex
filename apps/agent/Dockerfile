FROM node:22-slim AS base
WORKDIR /app

# Install Kraken CLI (Linux x86_64)
RUN apt-get update && apt-get install -y curl tar ca-certificates && \
    curl -sL https://github.com/krakenfx/kraken-cli/releases/download/v0.2.2/kraken-cli-x86_64-unknown-linux-gnu.tar.gz | tar -xz && \
    mv kraken-cli-x86_64-unknown-linux-gnu/kraken /usr/local/bin/kraken && \
    chmod +x /usr/local/bin/kraken && \
    apt-get remove -y curl tar && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/agent/package.json ./apps/agent/
COPY packages/shared/package.json ./packages/shared/
COPY packages/indexer/package.json ./packages/indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/agent/ ./apps/agent/
COPY packages/shared/ ./packages/shared/
COPY packages/indexer/ ./packages/indexer/

WORKDIR /app/apps/agent
ENV NODE_ENV=production
ENV KRAKEN_BIN=/usr/local/bin/kraken

CMD ["./node_modules/.bin/tsx", "src/index.ts"]
