# GoShipping — Global Freight & Supply Chain Platform

Enterprise multi-modal logistics platform built with **Astro + React + Cloudflare Kumo UI + Hono + MySQL/MariaDB & Drizzle ORM**.

---

## 🏗️ Architecture Stack

| Layer | Selected Technology |
|---|---|
| **Core Framework** | Astro v5 + TypeScript (SSR with `@astrojs/node` standalone) |
| **Interactive Frontend** | React v19 Islands (`@astrojs/react`) |
| **UI Components** | Cloudflare Kumo UI + Tailwind CSS v4 |
| **Backend API** | Hono embedded directly into Astro API routes (`src/pages/api/[...path].ts`) |
| **Database** | Hostinger MySQL / MariaDB + Drizzle ORM |
| **Authentication** | Server-side sessions + HttpOnly cookies + Role-Based Access Control (RBAC) |
| **Validation** | Zod |
| **Tracking Engine** | Adaptive near-real-time polling (20–30s interval with conditional hash responses) |
| **Deployment** | Hostinger Business / VPS + GitHub Integration |

---

## 🎨 Brand Design Tokens

- **GoShipping Red**: `#EA1D2C` — Primary CTA, verified progress pins, brand accents
- **Midnight Ink**: `#11181E` — High-contrast display typography, dark hero backgrounds & footer
- **Canvas White**: `#FFFFFF` — Primary application surfaces
- **Soft Red Surface**: `#F8E9EB` — Hover states, active tabs, subtle badges
- **Semantic Accents**: Success `#10B981` · Warning `#F59E0B` · Error `#EA1D2C`

---

## 📁 Project Structure

```
goshipping/
├── public/
│   └── brand/               # Official vector logos & favicon
│       ├── favicon.svg
│       ├── logo-light.svg   # Red Go mark + Midnight Ink lettering
│       └── logo-dark.svg    # Red Go mark + Canvas White lettering
├── src/
│   ├── components/
│   │   ├── admin/           # AdminOperationsIsland.tsx (KPIs, dispatch, pricing)
│   │   ├── dashboard/       # CustomerDashboardIsland.tsx (Shipments, quotes, docs)
│   │   ├── marketing/       # LiveTrackingIsland.tsx, QuoteCalculatorIsland.tsx
│   │   └── ui/              # Kumo UI tokenized wrappers
│   ├── layouts/
│   │   ├── PublicLayout.astro  # Static marketing layout with SEO & header/footer
│   │   └── AppLayout.astro     # Dynamic dashboard shell with RBAC sidebar
│   ├── middleware.ts        # Session authentication & route protection gate
│   ├── pages/
│   │   ├── index.astro      # Public homepage (prerendered)
│   │   ├── services/        # Air freight, ocean cargo, customs brokerage
│   │   ├── about.astro      # Fleet credentials & network
│   │   ├── contact.astro    # Global warehouse hub directory
│   │   ├── tracking/        # Live waypoint tracking portal
│   │   ├── login.astro      # One-click role login interface
│   │   ├── dashboard/       # Customer portal
│   │   ├── admin/           # Staff operations control
│   │   └── api/[...path].ts # Unified Hono API endpoint
│   ├── server/
│   │   ├── api/app.ts       # Hono backend API with Zod validation
│   │   ├── auth/session.ts  # Session creation, bcrypt hashing, RBAC matrix
│   │   ├── db/              # Drizzle ORM schema (16 tables) and MySQL pool
│   │   └── services/        # Shipment, Quote, Tracking, Warehouse & Audit services
│   └── styles/
│       ├── tokens.css       # Centralized design tokens (colors, radii, typography)
│       └── global.css       # Tailwind v4 import & accessibility standards
├── scripts/
│   └── seed.ts              # Database seeding script
├── astro.config.mjs
├── drizzle.config.ts
└── package.json
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 👥 Pre-Configured Test Accounts

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Customer** | `client@apextextiles.com` | `password` | Customer Dashboard (`/dashboard`) |
| **Super Admin** | `admin@goshipping.com` | `password` | Full Operations Control (`/admin`) |
| **Ops Manager** | `ops@goshipping.com` | `password` | Dispatch & Warehouse Management (`/admin`) |
| **Sales Team** | `sales@goshipping.com` | `password` | Quotation Pricing & Approvals (`/admin`) |
