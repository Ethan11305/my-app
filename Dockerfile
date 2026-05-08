# syntax=docker/dockerfile:1.7

# =====================================================================
#  my-app — DevSecOps hardened Dockerfile
#  策略：multi-stage build + non-root user + pinned base + 最小 attack surface
#
#  Base image 升級到 digest pin（建議在你建第一次 image 後做）：
#    docker pull node:20.18.1-slim
#    docker images --digests node:20.18.1-slim
#  把下面三個 FROM 改成： FROM node:20.18.1-slim@sha256:<digest> AS ...
# =====================================================================


# ---------- Stage 1: builder（編譯前端 + 用 esbuild 打包後端）----------
FROM node:20.18.1-slim AS builder

WORKDIR /app

# better-sqlite3 是 native module，需要 build tools（只在 builder 才有）
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# 1) 前端：vite build → dist/
RUN npm run build

# 2) 後端：用 esbuild 把 server.ts 打包成單檔 JS，runtime 就不需要 tsx/typescript
#    --packages=external 讓 require 走 node_modules（保留 better-sqlite3 native binding）
RUN npx --yes esbuild@0.24.0 server.ts \
      --bundle \
      --platform=node \
      --target=node20 \
      --packages=external \
      --outfile=dist-server/server.js


# ---------- Stage 2: prod-deps（只裝 production 依賴）----------
FROM node:20.18.1-slim AS deps

WORKDIR /app

# better-sqlite3 安裝時也需要 build tools（之後不會帶到 runtime stage）
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --omit=optional


# ---------- Stage 3: runtime（slim、non-root、無 build tools）----------
FROM node:20.18.1-slim AS runtime

# 安全更新 + 只裝必要 runtime 工具（curl 給 healthcheck，dumb-init 收 signal）
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends curl ca-certificates dumb-init \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# 建立 non-root user（uid 1001 與 host 端 mount 權限對齊）
RUN groupadd -r app -g 1001 \
 && useradd  -r -g app -u 1001 -m -d /home/app -s /bin/bash app

WORKDIR /app

# 只 copy 真正會在 runtime 用到的東西
COPY --from=deps    --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist          ./dist
COPY --from=builder --chown=app:app /app/dist-server   ./dist-server
COPY --chown=app:app package.json ./

# SQLite 資料庫從 host 掛進來；目錄要先存在且 owner = app
RUN mkdir -p /app/data && chown -R app:app /app

ENV NODE_ENV=production \
    PORT=3000

USER app

EXPOSE 3000

# Docker 層級 healthcheck（compose / k8s 都讀得到）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ || exit 1

# dumb-init 確保 SIGTERM 能正確傳到 node，避免容器收不到信號殭屍化
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist-server/server.js"]
