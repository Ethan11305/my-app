FROM node:20-slim

# 安裝編譯 better-sqlite3 所需的工具
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 複製 package 檔案並安裝依賴
COPY package*.json ./
RUN npm install

# 複製其餘程式碼並進行前端構建
COPY . .
RUN npm run build

# 開放 3000 端口
EXPOSE 3000

# 啟動服務
CMD ["npm", "start"]
