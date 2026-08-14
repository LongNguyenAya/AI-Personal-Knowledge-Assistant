# Build context là gốc monorepo (không phải backend-service/) — cần thấy được packages/db và
# packages/shared-types vì backend-service import cả 2 qua npm workspaces.
FROM node:24-alpine

WORKDIR /app

# Copy trước package.json để tận dụng Docker layer cache — chỉ khi các file này đổi thì mới
# phải "npm install" lại, code đổi mà dependency không đổi thì build lại nhanh.
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY backend-service/package.json backend-service/package.json

# Image này chỉ chạy backend-service, không đụng gì tới frontend-app — --workspace giới hạn
# npm chỉ cài đúng 3 workspace cần dùng (~180 packages thay vì ~670 nếu cài luôn cả Next.js/React
# của frontend-app), nhẹ hơn hẳn cho máy build yếu (EC2 free tier chỉ 1 vCPU/1GB RAM).
RUN npm install --workspace=backend-service --workspace=packages/db --workspace=packages/shared-types --include-workspace-root

COPY packages/db packages/db
COPY packages/shared-types packages/shared-types
COPY backend-service backend-service

WORKDIR /app/backend-service

EXPOSE 4000

# Chạy thẳng qua tsx (giống hệt "npm run dev" ở local, chỉ khác không có --watch) — không build
# sang JS riêng, vì packages/db được import thẳng dạng .ts qua workspace, không có bản compile sẵn.
CMD ["npx", "tsx", "src/index.ts"]
