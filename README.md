# my-app

使用 **React (Vite) + Express + SQLite** 開發的簡易投票系統，並以 **Docker + GCP Compute Engine + GitHub Actions** 完成容器化部署與基礎 CI/CD。

## 專案特色
- React + Vite 前端
- Express 後端 API
- SQLite 資料庫
- Docker 容器化
- Docker Compose 部署管理
- GCP VM 對外提供 HTTP 服務
- GitHub Actions 自動部署到 GCP VM
- SQLite volume 掛載，保留投票資料

## 技術棧
- React
- Vite
- Express
- SQLite
- Docker
- Docker Compose
- GCP Compute Engine
- GitHub Actions

## 專案結構
```bash
my-app/
├─ src/
├─ Dockerfile
├─ docker-compose.yml
├─ package.json
├─ package-lock.json
├─ server.ts
├─ vite.config.ts
├─ tsconfig.json
├─ index.html
├─ votes.db
└─ .github/workflows/deploy.yml
```

## 本機開發
安裝依賴：
```bash
npm install
```

啟動開發環境：
```bash
npm run dev
```

## Docker 建置與執行
### Build image
```bash
docker build -t my-app .
```

### Run container
```bash
docker run -d -p 80:3000 --name my-app-container my-app
```

### 掛載 SQLite 資料庫
```bash
docker rm -f my-app-container
docker run -d -p 80:3000 \
  --name my-app-container \
  -v $(pwd)/votes.db:/app/votes.db \
  my-app
```

## Docker Compose
### `docker-compose.yml`
```yaml
services:
  vote-app:
    build: .
    container_name: my-vote-app
    ports:
      - "80:3000"
    volumes:
      - ./votes.db:/app/votes.db
    restart: always
```

### 啟動
```bash
docker compose up -d --build
```

### 停止
```bash
docker compose down
```

### 查看狀態
```bash
docker compose ps
docker logs --tail 50 my-vote-app
```

## GCP 部署摘要
本專案部署於 GCP Compute Engine VM：

1. 建立 VM
2. 安裝 Docker / Docker Compose
3. 開放 `tcp:80`
4. 將專案部署到 `/home/j560111305/my-app`
5. 以 volume 掛載 `votes.db`
6. 使用外部 IP 對外提供服務

部署後可從瀏覽器開啟：
```text
http://<VM_EXTERNAL_IP>
```

## GitHub Actions 自動部署
當 push 到 `main` 分支時，GitHub Actions 會：
1. checkout code
2. 載入 SSH key
3. SSH 連進 GCP VM
4. `git pull origin main`
5. 清除舊容器
6. `docker compose up -d --build`

### Workflow 檔案
```text
.github/workflows/deploy.yml
```

### 需要設定的 GitHub Secrets
- `GCP_VM_HOST`
- `GCP_VM_USER`
- `GCP_VM_SSH_KEY`
- `GCP_APP_DIR`

## 問題與解決
### 1. SQLite 開檔失敗(剛開始用cloud run)
請確認：
- `votes.db` 已存在
- volume 路徑正確
- 容器內使用的資料庫路徑為 `/app/votes.db

### 2. 外部 IP 無法存取(http v.s. https)
請確認：
- 容器已啟動
- GCP 防火牆已開放 `tcp:80`

### 3. `docker-compose: command not found`
請確認已安裝 Docker Compose plugin：
```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
docker compose version
```

### 4. GitHub Actions SSH 失敗
請確認：
- `GCP_VM_SSH_KEY` 是完整私鑰
- 公鑰已加入 VM 可接受的 SSH keys
- `GCP_VM_USER` 正確

### 5. 容器名稱衝突
若出現：
```text
The container name "/my-vote-app" is already in use
```
請先移除舊容器，或在 deploy workflow 中加入：
```bash
docker rm -f my-vote-app 2>/dev/null || true
docker rm -f my-app-container 2>/dev/null || true
```

## 部署成果描述
本專案完成：
- Docker 容器化
- GCP VM 對外部署
- SQLite 資料持久化
- GitHub Actions 自動部署
- 基礎 CI/CD 實作

## 後續優化方向
- 健康檢查
- HTTPS / SSL
- SQLite 備份機制
- Registry-based deployment
- 監控與警告
