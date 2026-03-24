FROM node:22-slim AS base
WORKDIR /app

# Install Kraken CLI (Linux x86_64)
# NOTE: split steps + retries to reduce transient apt/GitHub failures on CI builders
RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    apt-get -o Acquire::Retries=3 update; \
    apt-get -o Acquire::Retries=3 install -y --no-install-recommends ca-certificates curl tar; \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    curl -fsSL https://github.com/krakenfx/kraken-cli/releases/download/v0.2.2/kraken-cli-x86_64-unknown-linux-gnu.tar.gz -o /tmp/kraken.tar.gz; \
    tar -xzf /tmp/kraken.tar.gz -C /tmp; \
    mv /tmp/kraken-cli-x86_64-unknown-linux-gnu/kraken /usr/local/bin/kraken; \
    chmod +x /usr/local/bin/kraken; \
    rm -f /tmp/kraken.tar.gz

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
