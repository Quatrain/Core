FROM oven/bun:alpine as builder

WORKDIR /app
COPY package.json ./
RUN bun install

COPY src ./src
COPY tsconfig.json ./

# Build the executable or run directly
RUN bun build src/index.ts --outdir dist --target bun

FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
