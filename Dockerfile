# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# --- Dependencies (include devDependencies for build) ---
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi

# --- Builder ---
FROM base AS builder
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r nodejs && useradd -r -g nodejs -m -d /home/nextjs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
