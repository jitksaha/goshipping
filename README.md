<div align="center">

# 🚢 GoShipping — Enterprise International Freight & Cargo Logistics Platform

[![Astro v5](https://img.shields.io/badge/Astro-5.4.0-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![React v19](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Cloudflare Kumo UI](https://img.shields.io/badge/Design_System-Cloudflare_Kumo-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://kumo.cloudflare.com)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-4.0.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Hono API](https://img.shields.io/badge/Backend-Hono_v4-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![MySQL / Drizzle ORM](https://img.shields.io/badge/Database-MySQL_%2B_Drizzle-00758F?style=flat-square&logo=mysql&logoColor=white)](https://orm.drizzle.team)
[![Resend Delivery](https://img.shields.io/badge/Email-Resend_API-000000?style=flat-square&logo=resend&logoColor=white)](https://resend.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-EA1D2C?style=flat-square)](LICENSE)

<br />

**High-velocity China-to-Bangladesh multi-modal freight forwarding, live waypoint tracking, automated customs clearance, and consignment quotation portal.**

[Explore Live Platform](https://goshipping.com.bd) · [Live Cargo Tracking](https://goshipping.com.bd/tracking) · [Ship for Me Concierge](https://goshipping.com.bd/quote)

</div>

---

## 📌 Executive Overview

**GoShipping** is an enterprise-grade logistics and global supply chain management platform engineered for cross-border e-commerce sellers, commercial manufacturers, and multinational trading houses importing cargo from **China to Bangladesh**.

Built on a unified single-process architecture powered by **Astro v5 SSR**, **React 19 Islands**, **Cloudflare Kumo UI**, **Hono REST API**, and **Drizzle ORM**, GoShipping eliminates fragmented third-party dashboards by fusing public brand discovery, instant quotation calculators, live authenticated waypoint telemetry, and high-security role-based operational portals into one seamless application.

---

## 🌟 Key Capabilities

### 1. 📡 Real-Time Waypoint Telemetry & Consignment Tracking
- **9 Standardized Logistics Milestones**:
  1. `PURCHASED` — Verified order placement & supplier dispatch
  2. `CN_WAREHOUSE_RECEIVED` — Intake scanning at Guangzhou, Shenzhen, or Yiwu hubs
  3. `DISPATCHED_FROM_CHINA` — Airway bill (AWB) generation & terminal departure
  4. `ARRIVED_DHAKA_AIRPORT` — Flight touchdown at Hazrat Shahjalal International Airport (DAC)
  5. `AWAITING_CUSTOMS_CLEARANCE` — Bonded customs inspection & tariff assessment
  6. `BD_WAREHOUSE_RECEIVED` — Central hub consolidation in Tejgaon / Uttara
  7. `PAYMENT_RECEIVED` — Verified freight settlement (independent financial milestone)
  8. `OUT_FOR_DELIVERY` — Local last-mile dispatch across 64 Bangladesh districts
  9. `DELIVERED` — Confirmed recipient handover with electronic proof-of-delivery (e-POD)
- **Zero-Flicker Live Status Synchronization**: Integrated push notifications with 12s adaptive conditional polling (`304 Not Modified` conditional ETag/hash validation), automatically paused when the browser tab is hidden to conserve server resources.
- **Privacy-Guaranteed Public Search**: Public tracking endpoints strictly redact customer PII, commercial billing data, and internal operational memos.

### 2. 🛩️ Multi-Modal Freight Services (China ⇄ Bangladesh)
- **Air Express Freight**: Rapid 3–7 day transit from Guangzhou Baiyun (CAN) & Shenzhen Bao'an (SZX) to Dhaka HSIA (DAC).
- **Ocean Cargo (FCL & LCL)**: Cost-optimized sea container shipping from Ningbo/Shenzhen berths to Chittagong Port CFS.
- **China Consolidation Warehouses**: Verified receiving, sorting, repackaging, and QC inspection in Guangzhou, Yiwu, and Shenzhen.
- **DDP Customs Brokerage**: End-to-end duty handling, customs tariff classification, and door-to-door delivery across Bangladesh.

### 3. 📦 "Ship for Me" Forwarding Concierge
- Instant freight calculator for 1688, Taobao, Alibaba, and factory-direct orders.
- Dynamic dimension and volumetric CBM weighting with real-time currency conversion (CNY / USD / BDT).
- Integrated customer selection allowing admin and sales staff to create consignments mapped directly to verified importer accounts.

### 4. 🛡️ Dual Left-Hand Centric Operations Portals
- **Staff Operations Control (`/admin`)**:
  - Live consignment board, status transition workflow, and waybill PDF generation.
  - User Directory with status toggles (Active / Suspended) and CRUD capabilities.
  - **Ghost Login (Masquerade)**: Super Admins can securely view the portal through any customer's profile without passwords to verify orders.
  - Resend Mailer diagnostics with real-time DNS status checks (`support.goshipping.com.bd`).
- **Customer Shipping Portal (`/dashboard`)**:
  - Active consignments overview, interactive milestone progress indicators, and invoice ledger.
  - One-click shareable tracking links and automated email delivery updates.

### 5. 📬 Branded Enterprise Communications (Resend Integration)
- Branded transactional email notifications dispatched via `notifications@support.goshipping.com.bd`.
- Automated notification triggers on:
  - Account signup & onboarding credentials
  - Consignment creation & quotation issuance
  - Waypoint milestone progress & customs clearance
  - Payment settlement & final doorstep delivery

---

## 🎨 Design Philosophy: Anti-AI-Slop & Swiss Precision

GoShipping rejects generic SaaS templates, arbitrary floating cards, and glowing purple gradients in favor of **Swiss industrial functionalism** and **Cloudflare Kumo UI** precision:

- **14px Content Standard**: Strict typographical hierarchy with 14px body content, `font-semibold` accents, and sentence-case headers.
- **Instant Hover Responses**: Zero sluggish hover color transitions; immediate tactile feedback on all interactive elements.
- **Zero Card Nesting**: Flat bento layouts and crisp `ring ring-kumo-line` borders with concentric border radii (`outer = inner + padding`).
- **Brand Palette Tokens**:
  - **Primary Red**: `#EA1D2C` (GoShipping Signature Red)
  - **Midnight Dark**: `#11181E` (Editorial contrast)
  - **Canvas Surface**: `#FFFFFF` / Soft Red `#F8E9EB`
  - **Border Gray**: `#E5E7EB` / `#E2E8F0`

---

## 🏗️ Technology Architecture

```
                                  [ Browser / Client ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ Astro v5 Static Pages ]             [ React 19 Interactive Islands ]
           (Services, About, FAQ, Terms)          (Tracking, Dashboards, Calculator)
                        │                                     │
                        └──────────────────┬──────────────────┘
                                           │
                                           ▼
                                [ src/middleware.ts ]
                         (Session Auth, Sliding 30-Day Cookie,
                            RBAC Security Gate, Dev Restore)
                                           │
                                           ▼
                         [ Astro APIRoute: src/pages/api/[...path].ts ]
                                           │
                                           ▼
                              [ Hono Embedded REST API ]
                               (/api/shipments, /api/quotes,
                                /api/tracking, /api/auth, /api/admin)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ Drizzle ORM / MySQL ]             [ Persistent File Failover ]
             (Hostinger 16 Tables Pool)             (.auth_store.json)
```

| Component | Technology | Role |
|---|---|---|
| **SSR Framework** | **Astro v5.4** | Server-Side Rendering via standalone `@astrojs/node` |
| **UI Layer** | **React v19 + Cloudflare Kumo** | High-performance interactive UI islands with zero hydration waste |
| **CSS Engine** | **Tailwind CSS v4** | Modern theme tokens, CSS variables, and layout discipline |
| **API Router** | **Hono v4** | Lightweight, typed micro-framework embedded directly in Astro endpoints |
| **Database** | **MySQL 8.0 / MariaDB** | Production relational persistence managed via **Drizzle ORM** |
| **Email Gateway**| **Resend API** | Branded transactional delivery via `support.goshipping.com.bd` |
| **Motion** | **Motion / GSAP** | Lightweight, accessible micro-interactions (`prefers-reduced-motion`) |

---

## 📁 Repository Structure

```
goshipping/
├── docs/
│   └── map/
│       ├── PRODUCT.md            # Product spec, user personas & modules
│       └── OPERATIONS.md         # Deployment, MySQL migrations, API routes
├── public/
│   ├── brand/                    # High-res SVG & PNG logos, favicons, app icons
│   └── og/                       # Open Graph share cards for social SEO
├── src/
│   ├── components/
│   │   ├── admin/                # AdminOperationsIsland.tsx (Dispatch, Users, Resend)
│   │   ├── analytics/            # TrackingHead.astro, TrackingBody.astro (GTM, Pixels)
│   │   ├── dashboard/            # CustomerDashboardIsland.tsx, GlobalSearchIsland.tsx
│   │   └── marketing/            # LiveTrackingIsland.tsx, QuoteCalculatorIsland.tsx
│   ├── layouts/
│   │   ├── AppLayout.astro       # Left-hand centric authenticated layout (Admin & Customer)
│   │   └── PublicLayout.astro    # Marketing layout with JSON-LD schema & meta tags
│   ├── pages/
│   │   ├── index.astro           # Homepage with Hero, Live Tracker & Services
│   │   ├── tracking/             # Dedicated Fullscreen Cargo Tracking Portal
│   │   ├── quote.astro           # Dedicated "Ship for Me" Freight Forwarding Concierge
│   │   ├── services/             # Air, Sea, Door-to-Door, Customs & Warehouse landing pages
│   │   ├── admin/                # Staff Operations Control Portal
│   │   ├── dashboard/            # Customer Consignment Management Portal
│   │   └── api/[...path].ts      # Unified Hono APIRoute integration
│   ├── server/
│   │   ├── api/app.ts            # Hono REST API with Zod payload validation
│   │   ├── auth/session.ts       # Sliding sessions, bcrypt, RBAC matrix & .auth_store.json
│   │   ├── db/
│   │   │   ├── client.ts         # MySQL pool connection with health check
│   │   │   └── schema.ts         # 16 Relational Drizzle ORM schema definitions
│   │   └── services/             # Shipment, Quote, Tracking, Warehouse, Email, Audit
│   └── styles/
│       ├── tokens.css            # Centralized GoShipping design tokens
│       └── global.css            # Tailwind v4 import & accessibility overrides
├── astro.config.mjs              # Astro configuration (standalone node adapter)
├── drizzle.config.ts             # Drizzle Kit migration configuration
├── package.json
└── README.md
```

---

## 🚀 Quick Start & Development Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm** or **pnpm**
- **MySQL / MariaDB** (Optional for local development; system gracefully uses persistent file failover)

### 2. Clone the Repository
```bash
git clone git@github.com:thedynime/go-shipping.git
cd go-shipping
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment
Copy the sanitized environment template:
```bash
cp .env.example .env
```
Update your credentials in `.env` (Never commit `.env` to version control):
```env
NODE_ENV=development
PORT=4321
HOST=0.0.0.0
APP_URL=http://localhost:4321

# Hostinger MySQL Connection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=goshipping

# Session & JWT Secrets
SESSION_SECRET=goshipping_local_development_secret_32chars_ok
JWT_SECRET=goshipping_jwt_dev_secret_token_secure_string_2026

# Resend API Key
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM_ADDRESS=notifications@support.goshipping.com.bd
```

### 5. Start Development Server
```bash
npm run dev
```
Access the application at [http://localhost:4321](http://localhost:4321).

---

## 🛠️ Production Build & Shared Hosting Deployment

### Build the Application
```bash
npm run build
```
This generates:
- Client-side static assets in `dist/client/`
- Node.js SSR entrypoint in `dist/server/entry.mjs`

### Run Standalone Production Server
```bash
npm start
# OR:
HOST=127.0.0.1 PORT=4321 node --env-file=.env ./dist/server/entry.mjs
```

### Hostinger Deployment Notes
- GoShipping runs under Node.js standalone mode without needing separate backend microservices or Docker daemons.
- In Hostinger Node.js Application manager, set the Application startup file to `dist/server/entry.mjs`.

---

## 👥 Default Staging & Testing Accounts

| Role | Email | Password | Access Path |
|---|---|---|---|
| **Super Admin** | `admin@goshipping.com` | `admin` | `/admin` (Full Operations & User Directory) |
| **Ops Manager** | `ops@goshipping.com` | `ops123` | `/admin` (Dispatch & Warehouse Intake) |
| **Dhaka Hub Officer**| `warehouse@goshipping.com`| `warehouse123` | `/admin` (Receiving & Waypoint Scans) |
| **Sales Team** | `sales@goshipping.com` | `sales123` | `/admin` (Tariffs & Quote Approvals) |
| **Verified Customer** | `client@apextextiles.com` | `client123` | `/dashboard` (Consignment Milestones & BOL) |

---

## 🔒 Security & Privacy Invariants

- **Isolated Server Environment**: All API logic runs within Astro SSR on port `4321`. No external unauthenticated ports.
- **Server-Side RBAC Enforcement**: Role authorization is executed on the server in `src/middleware.ts` and Hono route guards; never dependent on client UI visibility.
- **Public Tracking Anonymization**: Consignment searches via `/api/tracking/:code` return physical waypoint milestones without exposing customer identities or invoice sums.
- **Zero Secrets in Git**: Protected by strict `.gitignore` rules covering `.env`, `.auth_store.json`, and credentials.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.

Copyright © 2026 **The Dynime & Jit Kumar Saha** ([goshipping.com.bd](https://goshipping.com.bd)). All Rights Reserved.
