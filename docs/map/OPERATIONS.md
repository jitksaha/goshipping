# GoShipping — Operations & Deployment Manual

Operational guide for system provisioning, deployment to Hostinger, database management, and maintenance.

---

## 1. Hosting & Runtime Topology

| Layer | Hostinger Production Specification |
|---|---|
| **Runtime** | Node.js v20+ / v22+ (LTS) |
| **Server Process** | Single process executing `node ./dist/server/entry.mjs` |
| **Port** | Driven by `PORT` env var (Default: `4321`) |
| **Reverse Proxy** | Nginx / Apache handled by Hostinger Cloud |
| **Database** | Hostinger Managed MySQL / MariaDB (Port `3306`) |
| **Connection Pool** | Bounded pool (`connectionLimit: 10`) via `mysql2/promise` |

---

## 2. Environment Catalog

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Node environment |
| `PORT` | No | `4321` | Application HTTP listening port |
| `APP_URL` | Yes | `https://goshipping.com` | Base URL for links and CORS |
| `DB_HOST` | Yes | `127.0.0.1` | Hostinger MySQL hostname or IP |
| `DB_PORT` | Yes | `3306` | Database listening port |
| `DB_USER` | Yes | — | Database username |
| `DB_PASSWORD` | Yes | — | Database password |
| `DB_NAME` | Yes | `goshipping` | Master database name |
| `DB_CONNECTION_LIMIT`| No | `10` | Max concurrent pool connections |
| `SESSION_SECRET` | Yes | — | Minimum 32-character encryption key |
| `JWT_SECRET` | Yes | — | Token signing secret |
| `TRACKING_POLL_INTERVAL_MS` | No | `25000` | Client polling frequency (ms) |

---

## 3. Database Migration & Seeding Runbook

1. **Push Schema Directly**:
   ```bash
   npm run db:push
   ```
2. **Generate Migration Files**:
   ```bash
   npm run db:generate
   ```
3. **Seed Initial Records**:
   ```bash
   npm run db:seed
   ```
4. **Launch Drizzle Studio**:
   ```bash
   npm run db:studio
   ```

---

## 4. Background Scheduled Tasks (Cron)

In Hostinger Control Panel (hPanel) -> Advanced -> Cron Jobs:

| Frequency | Command / Endpoint Trigger | Purpose |
|---|---|---|
| `*/15 * * * *` | `curl -s -X POST https://goshipping.com/api/cron/sync-carriers` | Sync external airline / vessel API statuses |
| `0 2 * * *` | `curl -s -X POST https://goshipping.com/api/cron/cleanup-sessions` | Purge expired user sessions |
| `0 3 * * *` | `curl -s -X POST https://goshipping.com/api/cron/archive-quotes` | Archive expired quotations past validity date |

---

## 5. Health Verification & Smoke Testing

- **API Health Endpoint**: `GET /api/health`
  - Returns `status: "online"`, server timestamp, and live MySQL ping status.
- **Tracking Endpoint**: `GET /api/tracking/GOSH-2026-9812`
  - Returns verified timeline and HTTP 304 on duplicate requests with `If-None-Match`.
