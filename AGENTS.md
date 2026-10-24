# GoShipping — AI Agent Instructions & Workspace Protocol

Enterprise Logistics & Supply Chain Platform (Astro + React + Kumo UI + Hono + MySQL).

---

## 1. Project Overview & Read-First Order

- **Purpose**: High-velocity international freight forwarding, customs clearance, live tracking, and quotation portal.
- **Tech Stack**: Astro v5 (Node adapter standalone), React v19, Cloudflare Kumo UI, Tailwind CSS v4, Hono, MySQL/MariaDB + Drizzle ORM.
- **Read-First Navigation**:
  1. [`docs/map/PRODUCT.md`](file:///Users/jitkumarsaha/Projects/Goshipping/docs/map/PRODUCT.md) — Product specifications, user roles & modules.
  2. [`docs/map/OPERATIONS.md`](file:///Users/jitkumarsaha/Projects/Goshipping/docs/map/OPERATIONS.md) — Deployment, database, API and cron operations.
  3. [`DESIGN.md`](file:///Users/jitkumarsaha/Projects/Goshipping/DESIGN.md) — Brand tokens, typography, Kumo UI mappings & anti-slop rules.
  4. [`SYSTEM.md`](file:///Users/jitkumarsaha/Projects/Goshipping/SYSTEM.md) — System architecture, endpoints, database schema and security.

---

## 2. Hard Security & Engineering Invariants

1. **Integrated Server Architecture**:
   - Backend API is powered by Hono inside Astro endpoint [`src/pages/api/[...path].ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/pages/api/[...path].ts).
   - Never create a separate port or second server process for the API.
2. **Server-Side RBAC Enforcement**:
   - Every role permission (`super_admin`, `ops_manager`, `warehouse_staff`, `sales_team`, `support_agent`, `customer`) MUST be enforced server-side via [`src/middleware.ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/middleware.ts) and Hono route guards. Never rely only on client UI hiding.
3. **Public Tracking Privacy**:
   - [`/api/tracking/:code`](file:///Users/jitkumarsaha/Projects/Goshipping/src/server/services/tracking.service.ts) must NEVER expose private customer identities, billing amounts, or unverified GPS coordinates. Only verified carrier/warehouse waypoints are public.
4. **Credential & Secret Protection**:
   - Never print or leak secret keys, session tokens, or DB passwords. Mask as `[REDACTED]`.
5. **Anti-AI-Slop & Hallmark Floor**:
   - Colors and fonts must route through design tokens in [`src/styles/tokens.css`](file:///Users/jitkumarsaha/Projects/Goshipping/src/styles/tokens.css).
   - Never use `transition: all`. Never animate layout `width`/`height`/`top`/`left`.
   - Always enforce `overflow-x: clip` on `html` and `body`.

---

## 3. Core Commands

```bash
# Development server (http://localhost:4321)
npm run dev

# Production build & start
npm run build
npm start

# Database management (Drizzle ORM)
npm run db:generate    # Generate SQL migrations
npm run db:push        # Push schema directly to MySQL/MariaDB
npm run db:studio      # Launch Drizzle Studio web UI
npm run db:seed        # Seed initial operational records
```

---

## 4. Agent Reflexes

- **When adding or editing an API endpoint**: Keep business logic in `src/server/services/` and expose through `src/server/api/app.ts` with Zod validation.
- **When modifying tracking logic**: Maintain the adaptive polling contract (304 conditional hash responses on unchanged data, pause on `document.hidden`).
- **When styling components**: Use GoShipping brand tokens (`--color-brand-primary: #EA1D2C`, `--color-midnight: #11181E`, `--color-canvas: #FFFFFF`).
- **When altering database tables**: Update [`src/server/db/schema.ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/server/db/schema.ts) and update router tables in `docs/map/`.

---

## 5. Project Map Summary

| Area | Router / Authoritative Files |
|---|---|
| **Public Website** | [`src/pages/index.astro`](file:///Users/jitkumarsaha/Projects/Goshipping/src/pages/index.astro), [`src/pages/services/`](file:///Users/jitkumarsaha/Projects/Goshipping/src/pages/services), [`src/pages/tracking/`](file:///Users/jitkumarsaha/Projects/Goshipping/src/pages/tracking) |
| **Portals & Islands** | [`src/components/dashboard/`](file:///Users/jitkumarsaha/Projects/Goshipping/src/components/dashboard), [`src/components/admin/`](file:///Users/jitkumarsaha/Projects/Goshipping/src/components/admin), [`src/components/marketing/`](file:///Users/jitkumarsaha/Projects/Goshipping/src/components/marketing) |
| **API & Backend** | [`src/server/api/app.ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/server/api/app.ts), [`src/server/services/`](file:///Users/jitkumarsaha/Projects/Goshipping/src/server/services) |
| **Database & Auth** | [`src/server/db/schema.ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/server/db/schema.ts), [`src/server/auth/session.ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/server/auth/session.ts), [`src/middleware.ts`](file:///Users/jitkumarsaha/Projects/Goshipping/src/middleware.ts) |
| **Design System** | [`DESIGN.md`](file:///Users/jitkumarsaha/Projects/Goshipping/DESIGN.md), [`src/styles/tokens.css`](file:///Users/jitkumarsaha/Projects/Goshipping/src/styles/tokens.css), [`src/styles/global.css`](file:///Users/jitkumarsaha/Projects/Goshipping/src/styles/global.css) |
