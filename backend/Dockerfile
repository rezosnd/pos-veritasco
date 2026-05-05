FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
RUN npm ci
COPY . .

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/server.js .
COPY --from=build /app/scripts ./scripts
RUN mkdir -p uploads logs && chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 5000
CMD ["node", "server.js"]
