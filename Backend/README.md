# AssetOps — PostgreSQL Backend API

Node.js + Express + PostgreSQL REST API for the Asset Management System.

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE asset_management;"

# 3. Configure environment
cp .env.example .env
# Edit .env — set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET

# 4. Run migrations (creates all tables, indexes, triggers)
npm run migrate

# 5. Seed sample data
npm run seed

# 6. Start development server
npm run dev
```

Or run migrate + seed together:
```bash
npm run setup
```

---

## Environment Variables

| Variable      | Description                    | Default                   |
|---------------|--------------------------------|---------------------------|
| PORT          | Server port                    | 5000                      |
| DB_HOST       | PostgreSQL host                | localhost                 |
| DB_PORT       | PostgreSQL port                | 5432                      |
| DB_NAME       | Database name                  | asset_management          |
| DB_USER       | PostgreSQL username            | postgres                  |
| DB_PASSWORD   | PostgreSQL password            | —                         |
| JWT_SECRET    | JWT signing secret             | (required)                |
| JWT_EXPIRE    | Token expiry                   | 7d                        |
| NODE_ENV      | Environment                    | development               |
| FRONTEND_URL  | Allowed CORS origin            | http://localhost:3000     |

---

## Database Schema

### Tables

```
users
  id, name, email, password, role, is_active, created_at, updated_at

assets
  id, asset_id (PK unique), serial (unique), brand, model, config,
  processor, ram, storage, purchase_date, warranty_start, warranty_end,
  vendor, location, notes, status, created_at, updated_at

allocations
  id, allocation_id (unique), asset_id (FK→assets), emp_id, emp_name,
  emp_email, department, client, project, allocation_date, return_date,
  accessories (TEXT[]), status, notes, created_at, updated_at

repairs
  id, repair_id (unique), asset_id (FK→assets), issue, vendor,
  repair_date, estimated_return, actual_return, cost, status,
  notes, created_at, updated_at

scraps
  id, scrap_id (unique), asset_id (FK→assets), scrap_date,
  reason, approved_by, notes, created_at

audit_logs
  id, action, category, detail, asset_id, performed_by,
  meta (JSONB), created_at
```

### Status Values

| Table       | Field  | Allowed Values                          |
|-------------|--------|-----------------------------------------|
| assets      | status | Stock, Allocated, Repair, Scrap         |
| allocations | status | Active, Returned, Swapped               |
| repairs     | status | In Repair, Completed, Unrepairable      |
| users       | role   | admin, manager, viewer                  |

---

## API Reference

### Base URL: `http://localhost:5000/api`

### Authentication Header
```
Authorization: Bearer <jwt_token>
```

---

### Auth

| Method | Route                | Body / Notes                        |
|--------|----------------------|-------------------------------------|
| POST   | /auth/register       | `{ name, email, password, role }`   |
| POST   | /auth/login          | `{ email, password }`               |
| GET    | /auth/me             | Requires token                      |
| PUT    | /auth/password       | `{ currentPassword, newPassword }`  |

**Login response:**
```json
{ "success": true, "token": "eyJ...", "user": { "id": 1, "name": "Admin", "role": "admin" } }
```

---

### Assets

| Method | Route            | Role          | Description         |
|--------|------------------|---------------|---------------------|
| GET    | /assets          | All           | List assets         |
| GET    | /assets/stats    | All           | Dashboard stats     |
| GET    | /assets/:id      | All           | Get one asset       |
| POST   | /assets          | admin/manager | Create asset        |
| PUT    | /assets/:id      | admin/manager | Update asset        |
| DELETE | /assets/:id      | admin         | Delete asset        |

**Query params:** `status`, `search`, `page`, `limit`

**Create body:**
```json
{
  "asset_id": "LTB-280",
  "serial": "SN001",
  "brand": "Dell",
  "model": "Latitude 5540",
  "config": "i7 / 16GB / 512GB SSD",
  "processor": "Intel i7-1355U",
  "ram": "16GB DDR5",
  "storage": "512GB NVMe SSD",
  "purchase_date": "2024-01-10",
  "warranty_start": "2024-01-10",
  "warranty_end": "2027-01-10",
  "vendor": "Dell India",
  "location": "Bengaluru"
}
```

---

### Allocations

| Method | Route                     | Role          | Description       |
|--------|---------------------------|---------------|-------------------|
| GET    | /allocations              | All           | List allocations  |
| GET    | /allocations/:id          | All           | Get one           |
| POST   | /allocations              | admin/manager | Allocate laptop   |
| PUT    | /allocations/:id/receive  | admin/manager | Receive laptop    |
| PUT    | /allocations/:id/swap     | admin/manager | Swap laptop       |

**Allocate body:**
```json
{
  "asset_id": "LTB-273",
  "emp_id": "1003",
  "emp_name": "Priya Patel",
  "emp_email": "priya@company.com",
  "department": "Engineering",
  "client": "Infosys",
  "project": "Cloud Migration",
  "allocation_date": "2024-03-10",
  "accessories": ["Laptop Bag", "Charger"]
}
```

**Receive body:**
```json
{
  "condition": "good",
  "damage_description": ""
}
```
> `condition`: `good` → Stock | `repair` → Repair | `scrap` → Scrap

**Swap body:**
```json
{
  "new_asset_id": "LTB-274",
  "issue_type": "Hardware Failure",
  "issue_description": "Keyboard keys not working",
  "old_condition": "repair"
}
```

---

### Repairs

| Method | Route         | Role          | Description           |
|--------|---------------|---------------|-----------------------|
| GET    | /repairs      | All           | List repairs          |
| POST   | /repairs      | admin/manager | Create repair record  |
| PUT    | /repairs/:id  | admin/manager | Update repair         |

**Create body:**
```json
{
  "asset_id": "LTB-273",
  "issue": "Battery not charging",
  "vendor": "Dell Service Center",
  "estimated_return": "2024-04-01",
  "cost": 2500
}
```

**Mark as completed:**
```json
{ "status": "Completed", "actual_return": "2024-03-28", "cost": 2200 }
```

---

### Scraps

| Method | Route     | Role  | Description    |
|--------|-----------|-------|----------------|
| GET    | /scraps   | All   | List scraps    |
| POST   | /scraps   | admin | Scrap asset    |

```json
{ "asset_id": "LTB-272", "reason": "Screen damage beyond repair" }
```

---

### Reports

| Method | Route               | Description               |
|--------|---------------------|---------------------------|
| GET    | /reports/dashboard  | Full dashboard analytics  |
| GET    | /reports/warranty   | Warranty expiry report    |

---

### Audit Logs

| Method | Route                     | Description               |
|--------|---------------------------|---------------------------|
| GET    | /audit                    | All logs (paginated)      |
| GET    | /audit/asset/:assetId     | Logs for one asset        |

**Query params:** `category`, `search`, `page`, `limit`

---

## Transactions

The following operations use PostgreSQL transactions to ensure data consistency:

| Operation        | What's wrapped in one transaction                                         |
|------------------|---------------------------------------------------------------------------|
| Allocate laptop  | Insert allocation + update asset status to Allocated + write audit log    |
| Receive laptop   | Update allocation + update asset status + create repair/scrap if needed   |
| Swap laptop      | Update old allocation + update old asset + update new asset + new allocation |
| Create repair    | Insert repair record + update asset status to Repair                      |
| Scrap asset      | Insert scrap record + update asset status to Scrap                        |

---

## Demo Credentials (after seed)

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@company.com      | admin123    |
| Manager | manager@company.com    | manager123  |
| Viewer  | viewer@company.com     | viewer123   |
