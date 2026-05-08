# my-app — DevSecOps Hardened Voting App

> 一個 React + Express + SQLite 投票系統的 **DevSecOps 重構**。
> 從「能 deploy」進化到「**安全 deploy**」 — 補完 CI 安全掃描、Workload Identity、零信任部署、自動 rollback。

[![CI](https://github.com/Ethan11305/my-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Ethan11305/my-app/actions/workflows/ci.yml)
[![Deploy](https://github.com/Ethan11305/my-app/actions/workflows/deploy.yml/badge.svg)](https://github.com/Ethan11305/my-app/actions/workflows/deploy.yml)
![Node](https://img.shields.io/badge/node-20.18.1-success)
![Trivy](https://img.shields.io/badge/Trivy-CRITICAL%2FHIGH%20block-critical)
![WIF](https://img.shields.io/badge/Auth-Workload%20Identity%20Federation-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📋 專案概覽

這個 repo 同時是**產品**(投票應用)和**教材**(展示如何把舊 CI/CD 升級為 DevSecOps)。

| 維度 | Before(`main` branch) | After(`feature/devsecops` branch) |
|------|----------------------|-----------------------------------|
| **Build 位置** | VM 上 `git pull` 後 build | GitHub Actions runner build,VM 只拉 image |
| **Image 來源** | VM 本地 build,無版本追溯 | GCP Artifact Registry,SHA tag 永久保留 |
| **資安掃描** | 無 | gitleaks + npm audit + Trivy fs + Trivy image |
| **GCP 認證** | SA JSON key 存 GitHub Secret | **Workload Identity Federation**(無長期憑證) |
| **SSH 私鑰** | 寫到 runner 檔案 | `ssh-agent` in-memory |
| **Rollback** | 手動 SSH 救援 | 健檢失敗自動退回上一版 |
| **Container User** | root | non-root uid 1001 |
| **Image Tag** | `:latest`(漂移) | `:${SHA}` 鎖死 + 可升級到 digest pin |

---

## 🛡️ 三個關鍵安全改動

### 1. **Build 不在 VM 上做** — Immutable Artifact

VM 不再有 source code、build tools、或 npm registry token。

```
舊流程:                          新流程:
GitHub → SSH → VM                GitHub Actions runner
         ↓                              ↓
       git pull                     docker build
         ↓                              ↓
       docker build                 trivy scan
         ↓                              ↓
       docker run                   push to Artifact Registry
                                        ↓
                                    SSH → VM → docker pull → swap
```

**好處**:
- VM 攻擊面降低(無 build tools、無 source code)
- 每個 commit 對應一個不可變 image,**rollback 變成「換 tag」**
- Build 環境一致(GitHub runner)消除「在我電腦上沒問題」

### 2. **掃完才 push** — Preventive over Detective

CI pipeline 拒絕讓有漏洞的 image 進 registry。

```
docker build (locally on runner, load=true, push=false)
        ↓
Trivy image scan (severity: CRITICAL,HIGH; exit-code: 1)
        ↓
若任何 CRITICAL/HIGH 漏洞 → ❌ pipeline 失敗,image 永不 push
        ↓
若全清白 → ✅ push to Artifact Registry
```

**搭配** `.trivyignore` 例外管理:
- 每筆例外**必填 reason + 90 天重檢日**
- 例外當作「**債務**」追蹤,不是「**封口**」

### 3. **WIF 取代 SA JSON Key** — No Long-Lived Credentials

```
舊做法:                            新做法:
GitHub Secret: GCP_SA_KEY (JSON)   GitHub OIDC token (15min lifetime)
        ↓                                  ↓
JSON 解出 → 長期憑證 → push        OIDC → WIF Pool → 換 SA short-lived token
                                          ↓
                              attribute-condition 鎖定
                                  Ethan11305/my-app
```

**Attribute condition**(`SETUP.md` 第二章 §3):
```
assertion.repository == 'Ethan11305/my-app'
```

→ **就算其他 repo 拿到 GitHub OIDC token 也換不到我的 SA**。

---

## 🏗️ 架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌──────────────┐    ┌─────────────────────────┐            │
│  │ Source Code  │    │ .github/workflows/      │            │
│  │ (TS/React)   │    │   ├─ ci.yml             │            │
│  │              │    │   └─ deploy.yml         │            │
│  └──────────────┘    └─────────────────────────┘            │
└────────────────────────────┬────────────────────────────────┘
                             │ push to main
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              CI Pipeline (GitHub Actions runner)             │
│                                                              │
│  Stage 1: Lint & Type check                                  │
│  Stage 2: Secret Scan (gitleaks)                             │
│  Stage 3: SCA (npm audit, block on high+)                    │
│  Stage 4: Trivy fs scan (vuln + config + secret)             │
│  Stage 5: Build image (load locally, NOT pushing yet)        │
│  Stage 6: Trivy image scan (block CRITICAL/HIGH)             │
│  Stage 7: Push to Artifact Registry (only main branch)       │
│                                                              │
│             ↑ all stages must pass to push ↑                 │
└─────────────────────────────┬────────────────────────────────┘
                              │ workflow_run (success)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Deploy Pipeline (GitHub Actions runner)            │
│                                                              │
│   ssh-agent ←─── SSH key (in-memory, no file write)          │
│         │                                                    │
│         ▼                                                    │
│   ssh GCP VM ─→ docker pull <region>-docker.pkg.dev/.../my-app:<SHA>
│                       │                                      │
│                       ▼                                      │
│                 docker compose up -d                         │
│                       │                                      │
│                       ▼                                      │
│                 health check (10x retry)                     │
│                       │                                      │
│              ┌────────┴────────┐                             │
│              ▼                 ▼                             │
│           ✅ pass            ❌ fail                          │
│            done             rollback to .env.prev            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Production (GCP Compute Engine VM)              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Container: my-vote-app                             │     │
│  │   - non-root user (uid 1001)                       │     │
│  │   - dumb-init (signal handling)                    │     │
│  │   - healthcheck (curl localhost:3000)              │     │
│  │   - mem 512m / cpu 0.5 / log rotation              │     │
│  │   - Volume: /opt/my-app/data → /app/data (SQLite)  │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 安全控制矩陣

| 層級 | 控制項 | 實作位置 |
|------|--------|---------|
| **Source** | Secret 掃描 | `ci.yml` Stage 2(gitleaks 掃 git history) |
| **Source** | `.gitignore` 排除 `.env`、`*.db` | repo root |
| **Dependency** | 漏洞掃描 | `ci.yml` Stage 3(`npm audit --audit-level=high`) |
| **Build** | IaC misconfig 掃描 | `ci.yml` Stage 4(Trivy `misconfig` scanner) |
| **Build** | Multi-stage,移除 build tools | `Dockerfile`(builder/deps/runtime 三段) |
| **Build** | esbuild bundling 後端,移除 tsx 依賴 | `Dockerfile` Stage 1 |
| **Image** | OS + library 漏洞掃描 | `ci.yml` Stage 6(Trivy image scan) |
| **Image** | Tag pin(`node:20.18.1-slim`)+ 可升級 digest | `Dockerfile` |
| **Image** | Non-root user(uid 1001) | `Dockerfile` Stage 3 |
| **Image** | Signal handling(dumb-init) | `Dockerfile` ENTRYPOINT |
| **Auth** | Workload Identity Federation(無長期 SA key) | `ci.yml` + `deploy.yml` + `SETUP.md` |
| **Auth** | SSH 私鑰用 ssh-agent(不落盤) | `deploy.yml` |
| **Runtime** | Resource limit(mem/cpu) | `docker-compose.prod.yml` |
| **Runtime** | Log rotation(防止磁碟塞爆) | `docker-compose.prod.yml` |
| **Runtime** | Healthcheck(Docker + Compose 兩層) | `Dockerfile` HEALTHCHECK + compose |
| **Deploy** | 失敗自動 rollback(`.env.prev`) | `deploy.yml` |
| **Audit** | SARIF 上傳到 GitHub Security tab | `ci.yml`(Trivy fs/image scans) |
| **Governance** | 例外清單需 reason + 重檢日 | `.trivyignore` |

---

## 📁 檔案結構

```
my-app/
├── .github/workflows/
│   ├── ci.yml                  ← 6 stage CI pipeline
│   └── deploy.yml              ← 自動 rollback 部署
├── src/                        ← React frontend
├── server.ts                   ← Express backend
├── Dockerfile                  ← multi-stage,non-root
├── docker-compose.prod.yml     ← VM 端 production compose
├── .trivyignore                ← 掃描例外清單(reason + 重檢日)
├── .env.example                ← 環境變數範本
├── package.json
├── tsconfig.json
├── SETUP.md                    ← 一次性 GCP/GitHub/VM 設定指南
└── README.md                   ← 你正在看
```

---

## 🚀 Quick Start

### 開發者

```bash
# Clone
git clone git@github.com:Ethan11305/my-app.git
cd my-app
git checkout feature/devsecops

# 本機跑(沒 docker 也能)
npm install
npm run dev    # 前端
npm run server # 後端

# 本機跑(完整 container)
docker compose up --build
```

### 部署 production

詳見 **[SETUP.md](SETUP.md)** — 包含:
- GitHub Variables / Secrets 清單
- GCP Artifact Registry + WIF Pool 設定
- VM 端 chown、gcloud CLI 安裝
- 第一次測試的順序

---

## 🎓 設計決策(Design Notes)

### 為何選 Trivy 不選 Snyk / Anchore?
- **單一 binary**,容器化整合簡單
- **三合一**(vuln + misconfig + secret)在同一工具,減少 pipeline 複雜度
- **開源 + 商業支援**(Aqua Security)
- **SARIF 輸出**直接上 GitHub Security tab

### 為何 esbuild bundling 後端?
- 原本 runtime 需要 `tsx`(TypeScript 直譯器),靠它跑 `.ts` 檔
- bundle 後 runtime **只需 `node` + bundled JS**,**移除 50+ 個 dev dependency**
- 縮短 image size,降低 supply chain attack surface

### 為何 SQLite 用 volume mount 而不打進 image?
- DB 是**狀態**,image 是**程式碼**,兩者生命週期不同
- `docker compose down && up` 不會洗掉資料
- Volume 在 host 上,uid 1001:1001 owner 對應 container 內 user(避免 EACCES)

### 為何 healthcheck 重試 10 次?
- 容器 cold start 不只是「程式起來」 — 還要 SQLite open connection、reading config
- start_period 20s + 10 次 × 5s = 最多 70 秒緩衝
- 避免「短暫 503 觸發誤判 rollback」

---

## 🐛 Known Issues / TODOs

- [ ] `server.ts` 把 DB 路徑改成讀 `process.env.DB_PATH`(目前寫死 `./votes.db`)
- [ ] CI 補 unit test,把 `ci.yml` 裡的 `npm test` 步驟打開
- [ ] Dockerfile 三個 FROM 升級到 digest pin(SETUP.md 第三章 §1 有指令)
- [ ] 加 SBOM 產生(Syft)+ 上傳 release artifact
- [ ] 考慮用 Cosign 做 image signing(supply chain 進階)

---

## 📚 進一步閱讀

- [SETUP.md](SETUP.md) — 完整一次性設定指南
- [GCP WIF 官方文件](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Trivy 文件](https://aquasecurity.github.io/trivy)
- [OWASP Top 10 CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/)

---

## 📜 License

MIT — 詳見 LICENSE
