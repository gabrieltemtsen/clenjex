FROM node:22-slim AS base
WORKDIR /app
RUN npm install -g pnpm@9.15.4

# Install deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source + build
COPY apps/dashboard/ ./apps/dashboard/
COPY packages/shared/ ./packages/shared/

WORKDIR /app/apps/dashboard
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "start"]
