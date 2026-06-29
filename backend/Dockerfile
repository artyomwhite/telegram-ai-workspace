FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

RUN npm ci --omit=dev --ignore-scripts && chmod +x scripts/migrate-safe.sh

COPY --from=builder /app/dist ./dist

RUN npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "./scripts/migrate-safe.sh; node dist/main.js"]
