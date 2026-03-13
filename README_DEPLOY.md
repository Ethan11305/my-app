# 部署指南 (VM 部署)

由於 Cloud Run 是暫時性的容器，數據會在重啟時消失。若要永久保存數據，建議將此服務部署在您的 VM (如 GCP Compute Engine, AWS EC2 等) 上。

## 方法一：使用 Docker (推薦)

這是最簡單的方法，可以避免環境配置問題。

1. **安裝 Docker**: 在您的 VM 上安裝 Docker。
2. **上傳程式碼**: 將此專案的所有檔案上傳到 VM。
3. **構建鏡像**:
   ```bash
   docker build -t study-group-vote .
   ```
4. **啟動容器**:
   ```bash
   docker run -d -p 80:3000 -v $(pwd)/votes.db:/app/votes.db --name vote-app study-group-vote
   ```
   *注意：`-v` 參數會將資料庫檔案掛載到主機，確保數據永久保存。*

## 方法二：直接在 VM 運行

1. **安裝環境**: 安裝 Node.js (v20+)。
2. **安裝依賴**:
   ```bash
   npm install
   ```
3. **構建與啟動**:
   ```bash
   npm run build
   npm start
   ```
4. **持久化運行**: 建議使用 `pm2` 來管理進程：
   ```bash
   npm install -g pm2
   pm2 start npm --name "vote-app" -- start
   ```

## 注意事項
* **防火牆**: 請確保 VM 的防火牆已開啟 80 (或 3000) 端口。
* **資料備份**: 定期備份 `votes.db` 檔案。
