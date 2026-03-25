FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建项目
RUN pnpm build

# ============================================================
# 生产镜像
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm

# 复制依赖和构建产物
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY server/ ./server/

# 安装 tsx 用于运行迁移
RUN pnpm add -D tsx drizzle-kit

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
