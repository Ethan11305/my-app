# my-app DevSecOps Pipeline — 部署指南

把這個資料夾的檔案搬進 `my-app` repo 的對應位置：

```
my-app/
├─ .github/workflows/ci.yml          ← 取代原本任何 build/push workflow
├─ .github/workflows/deploy.yml      ← 取代原本的 deploy.yml
├─ .trivyignore                      ← 例外清單（先空白，掃出問題再加）
├─ Dockerfile                        ← 取代原本的 Dockerfile
└─ docker-compose.prod.yml           ← 新增；deploy 時會上傳到 VM 改名為 docker-compose.yml
```

Pipeline 流程：
```
push to main
    │
    ▼
[CI] lint → secret scan → npm audit → Trivy fs/config/secret
    │
    ▼
build image → Trivy image scan → push to Artifact Registry
    │
    ▼
[Deploy] SSH → pull image → swap container → health check → (失敗則 rollback)
```

---

## 一、GitHub 端設定

### Repository variables（Settings → Variables）

| 名稱             | 範例值                | 說明                            |
| ---------------- | --------------------- | ------------------------------- |
| `GCP_PROJECT_ID` | `your-gcp-project-id` | GCP 專案 ID                     |
| `GCP_REGION`     | `asia-east1`          | Artifact Registry 所在 region   |
| `GCP_AR_REPO`    | `my-app-repo`         | Artifact Registry repository 名 |

### Repository secrets（Settings → Secrets）

| 名稱                | 用途                                        |
| ------------------- | ------------------------------------------- |
| `GCP_WIF_PROVIDER`  | Workload Identity Federation provider 完整路徑 |
| `GCP_SA_EMAIL`      | 用來 push image 的 GCP service account email |
| `GCP_VM_HOST`       | VM 外部 IP / 主機名（既有，沿用）           |
| `GCP_VM_USER`       | VM ssh user（既有，沿用）                   |
| `GCP_VM_SSH_KEY`    | VM ssh 私鑰（既有，沿用）                   |
| `GCP_APP_DIR`       | VM 上 app 目錄，例：`/home/youruser/my-app` |

### Environments

建一個 `production` environment（Settings → Environments → New），可設審核者，這樣 deploy 前會擋一個人工 approve。

---

## 二、GCP 端一次性設定

### 1. 建 Artifact Registry repo

```bash
gcloud artifacts repositories create my-app-repo \
  --repository-format=docker \
  --location=asia-east1 \
  --description="my-app images"
```

### 2. 建 service account 給 GitHub Actions 用

```bash
gcloud iam service-accounts create gh-actions-deployer \
  --display-name="GitHub Actions deployer"

# 授權 push image 到 Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gh-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 3. 設定 Workload Identity Federation（取代 SA key）

> 不要用 SA JSON key 存在 GitHub secrets — 改用 WIF 是 GCP 官方推薦做法，無長期憑證、可細粒度管控。

```bash
# 建 WIF pool
gcloud iam workload-identity-pools create gh-pool \
  --location=global

# 建 OIDC provider 接 GitHub
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=gh-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='Ethan11305/my-app'"

# 允許指定 repo 冒用 SA
gcloud iam service-accounts add-iam-policy-binding \
  gh-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/gh-pool/attribute.repository/Ethan11305/my-app"
```

把對應的 provider 完整路徑（長得像 `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/gh-pool/providers/github-provider`）填進 `GCP_WIF_PROVIDER` secret。

---

## 三、VM 端一次性設定

```bash
# 建 SQLite 資料目錄並調整權限（uid 1001 對應 Dockerfile 裡的 app user）
sudo mkdir -p /opt/my-app/data
sudo chown -R 1001:1001 /opt/my-app/data

# 如果舊的 votes.db 要保留：
# sudo cp ~/my-app/votes.db /opt/my-app/data/votes.db
# sudo chown 1001:1001 /opt/my-app/data/votes.db

# 安裝 gcloud CLI（讓 docker pull 能拿到 Artifact Registry token）
sudo apt-get update && sudo apt-get install -y google-cloud-cli

# 認證 docker 用 metadata server（GCP VM 預設 SA 要有 artifactregistry.reader）
gcloud auth configure-docker asia-east1-docker.pkg.dev --quiet
```

VM 預設 SA 給 reader 權限：
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$VM_SA_EMAIL" \
  --role="roles/artifactregistry.reader"
```

---

## 四、Code-side 待辦

| 項目                                             | 為什麼                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| 把 `votes.db` 從 git 拿掉並加進 `.gitignore`     | 資料庫不該進版控；歷史外洩風險                         |
| `server.ts` 把 DB 路徑改成讀 `process.env.DB_PATH ?? './votes.db'` | 配合 compose 把 DB 放在 `/app/data/votes.db`           |
| 補一兩個 unit test，把 `ci.yml` 裡 `npm test` 打開 | 沒測試的 pipeline 講不過去                             |
| 把 `tsx` 留在 devDependencies 即可               | runtime 改用 esbuild 打包成 dist-server/server.js，不依賴 tsx |
| 跑一次 `docker pull node:20.18.1-slim` 取 digest，把 Dockerfile 裡的三個 FROM 升級到 digest pin | 完成「pin digest」，避免 supply chain drift            |

---

## 五、第一次測試的順序

1. 推一個小改動到一個 feature branch → 開 PR → 看 CI 跑（不 push image，只跑掃描）。
2. 把 PR merge 進 `main` → 看 CI 完整跑完並 push image → 看 deploy.yml 自動觸發。
3. 故意改一個會壞掉的東西到 main（例：把 server.ts 的 port 改成 9999）→ 確認 health check 失敗 → 確認 rollback 把舊版救回來。

---

## 六、面試／答辯時可以指的東西

| 面試問題                          | 指這個                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| CI/CD 用什麼？有哪些 stage？      | `.github/workflows/ci.yml` — 6 個 stage 在裡面                   |
| 有沒有資安檢查？                  | gitleaks（secret）、npm audit（SCA）、Trivy fs+image+config     |
| 鏡像掃描怎麼做？                  | `build-scan-push` job — 先 build → Trivy 掃 → 過了才 push      |
| 怎麼保證部署到 production 安全？  | WIF 取代 SA key、SSH 用 ssh-agent、image 走 Artifact Registry、deploy 失敗自動 rollback |
| Dockerfile 做了什麼加固？         | multi-stage、non-root user (uid 1001)、tag pin、dumb-init、healthcheck |
| 例外管理？                        | `.trivyignore` 每筆都有 reason + 重檢日                         |
