# 离心机转子配平工作台 — 单镜像启动
# 构建期完成依赖安装与前端打包，运行期由 Node/Express 同时提供 API 与静态资源
FROM node:20-alpine

WORKDIR /app

# 优先拷贝依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并执行：TypeScript 类型检查 + Vite 生产构建（产物输出到 dist/）
COPY . .
RUN npm run build

ENV NODE_ENV=production
# 应用监听端口（docker-compose 中映射到宿主机同名端口）
ENV PORT=3001
EXPOSE 3001

# 启动即完成“初始化”：直接拉起 Node 服务（tsx 运行 TS 服务端，内含静态托管）
CMD ["npm", "start"]
