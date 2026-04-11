# Corporate Fuel Management System (CFMS)

A centralized B2B2C platform where organizations pre-purchase or allocate fuel quotas to employees via RFID cards. Petrol stations use RFID-enabled POS terminals to verify and deduct fuel amounts in real-time.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Admin Portal | React + TypeScript + Vite + Tailwind CSS |
| Auth | JWT (role-based) |
| Validation | Zod |

## Project Structure

```
EnergyDispenX/
├── server/                  # Backend API
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── src/
│       ├── config.ts        # Environment config
│       ├── app.ts           # Express app setup
│       ├── index.ts         # Server entry point
│       ├── seed.ts          # Database seeder
│       ├── schemas.ts       # Zod validation schemas
│       ├── lib/prisma.ts    # Prisma client instance
│       ├── middleware/       # Auth, validation, error handling
│       └── routes/          # API route handlers
├── admin/                   # React Admin Portal
│   └── src/
│       ├── App.tsx          # Main routing
│       ├── context/         # Auth context
│       ├── components/      # Layout, Sidebar
│       ├── pages/           # Dashboard, Employees, Stations, etc.
│       └── lib/api.ts       # Axios API client
└── docker-compose.yml       # PostgreSQL container
```

## Quick Start

### 1. Start Database
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
cd server && npm install
cd ../admin && npm install
```

### 3. Setup Database
```bash
cd server
cp .env.example .env        # Edit if needed
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Run Development Servers
```bash
# Terminal 1 - API Server (port 4601)
cd server && npm run dev

# Terminal 2 - Admin Portal (port 4602)
cd admin && npm run dev

# Optional: Staff (4603), Station (4604)
# cd staff && npm run dev
# cd station && npm run dev
```

### 5. Login
Open http://localhost:4602 and use:
- **Super Admin**: `admin@energydispenx.com` / `Admin123!`
- **Fleet Manager**: `fleet@energydispenx.com` / `Fleet123!`
- **Finance**: `finance@energydispenx.com` / `Finance123!`

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Register user (Admin only) |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/pos/login` | POS terminal login (API key) |

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations` | List organizations |
| POST | `/api/organizations` | Create organization |
| PUT | `/api/organizations/:id` | Update organization |

### Employees & Cards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List employees (paginated, searchable) |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| POST | `/api/employees/:id/quota` | Assign/top-up quota |
| POST | `/api/employees/card/block` | Block/unblock RFID card |

### Stations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stations` | List stations |
| POST | `/api/stations` | Create station (generates API key) |
| PATCH | `/api/stations/:id/pump-price` | Update pump price |
| POST | `/api/stations/whitelist` | Whitelist station for org |

### POS / Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/card/balance/:rfidUid` | Check card balance (POS) |
| POST | `/api/transaction/deduct` | Deduct fuel (POS, idempotent) |
| POST | `/api/transaction/sync/batch` | Batch upload offline txns (POS) |
| GET | `/api/transactions` | List transactions (Admin) |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settlements` | List settlements |
| POST | `/api/settlements/generate` | Generate monthly settlements |
| PATCH | `/api/settlements/:id/status` | Mark as paid/disputed |
| GET | `/api/settlements/monthly/:stationId` | Monthly summary |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard summary stats |

## Key Features

- **Dual Quota Modes**: Naira (₦) or Liters with automatic conversion at current pump price
- **Idempotent Deductions**: Prevents duplicate charges via idempotency keys
- **Offline POS Support**: Batch sync endpoint for uploading queued transactions
- **Station Whitelisting**: Cards only work at authorized stations
- **PIN for Large Deductions**: Second-factor auth for deductions >50L or >₦50,000
- **Role-Based Access**: SUPER_ADMIN, ADMIN, FLEET_MANAGER, FINANCE, STATION_ATTENDANT
- **Monthly Settlement**: Automated aggregation with status tracking (Pending → Settled)
- **CSV Export**: Transaction export for accounting software
- **Rate Limiting**: API-wide + stricter limits on auth endpoints

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT authentication with expiry
- Helmet for HTTP security headers
- Input validation via Zod on all endpoints
- Rate limiting on all API routes
- Station auth via dedicated API keys
- RBAC enforced at route level
