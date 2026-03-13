<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# my-app

一個使用 **React (Vite) + Express + SQLite** 開發的投票系統，並以 **Docker、GCP Compute Engine、GitHub Actions** 完成容器化部署與基礎 CI/CD。

## Features

- React + Vite 前端介面
- Express 後端 API
- SQLite 資料儲存
- Docker 容器化部署
- Docker Compose 管理服務
- GCP VM 對外提供 HTTP 服務
- GitHub Actions 自動部署到 GCP VM
- SQLite volume 掛載，保留投票資料

## Tech Stack

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

