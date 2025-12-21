# Helios Client Portal

> **Self-Hosted Google Workspace Management with Full API Access & Audit Trail**

## Overview

Helios is a self-hosted management platform for Google Workspace. It provides a modern UI for common admin tasks while giving power users direct API access through an audited proxy console. Every action—whether through the UI or API—is logged for compliance and security.

**Why Helios?**

- **Data Sovereignty:** Your data stays on your infrastructure. No third-party SaaS touches your directory or emails.
- **API Proxy with Audit Trail:** Execute any Google Workspace API call through Helios. Every request is logged with who, what, when, and the full response—even for APIs without UI features yet.
- **Cost Efficiency:** Alternatives like BetterCloud ($3-5/user/month) or GAT Labs ($2-4/user/month) add up fast. Helios is a fixed infrastructure cost.
- **Power User Friendly:** Know the Google Admin SDK? Use it directly through the console. Don't know it? Use the UI.

---

## Key Features

### 1. Audited API Proxy Console
*Full Google Workspace API access with complete audit trail.*

- **Direct API Access:** Call any Google Admin SDK endpoint through Helios
- **Full Audit Logging:** Every API request logged with actor, timestamp, request, and response
- **Use Before UI Exists:** Need a feature we haven't built yet? Use the API directly
- **Compliance Ready:** Demonstrate exactly what changes were made and by whom

### 2. User & Directory Management
*Comprehensive user lifecycle from a single interface.*

- **User Directory:** View, search, and manage all Google Workspace users
- **Groups Management:** Create and manage groups, membership, and access
- **Org Chart:** Visualize reporting relationships and organizational structure
- **Bulk Operations:** Import users via CSV, bulk update attributes

### 3. User Lifecycle Automation
*Streamline onboarding and offboarding.*

- **Workflow Builder:** Visual drag-and-drop workflow creation
- **Scheduled Actions:** Pre-provision users or schedule access revocation for future dates
- **Onboarding Templates:** Define standard setup steps for new hires by role/department
- **Offboarding Workflows:** Data transfer, access revocation, account suspension

### 4. Email Signature Management
*Centralized signatures without per-user SaaS fees.*

- **Dynamic Templates:** Variables like `{{Name}}`, `{{JobTitle}}`, `{{Department}}` auto-populate
- **Campaign Banners:** Schedule promotional banners for specific teams or date ranges
- **Direct API Deployment:** Push signatures directly to Gmail settings—no agents needed
- **Analytics:** Optional tracking pixels for engagement metrics

### 5. Asset Proxy & Drive Management
*Secure file sharing with branded URLs.*

- **Google Drive Proxy:** Share assets from a private Shared Drive via branded URLs
- **Access Logging:** Track who accesses files and when
- **No Public Links:** Keep Drive files private while still sharing externally

### 6. Admin/User Separation
*Self-service for employees, full control for admins.*

- **Self-Service Portal:** Users can view their profile, org chart, and company resources
- **Role-Based Access:** Admins see everything; users see only what's relevant to them
- **View Switching:** Admins can preview what users see

---

## Comparison

| Feature | Helios | BetterCloud / GAT | GAM (CLI) |
| :--- | :---: | :---: | :---: |
| **Data Location** | Your Infrastructure | SaaS Cloud | Local Machine |
| **Interface** | Modern Web UI | Modern Web UI | Command Line |
| **API Access** | Full + Audited | Limited | Full |
| **Audit Trail** | Every Action Logged | Varies | Manual |
| **Cost Model** | Fixed Infrastructure | $30-60/user/year | Free |
| **Setup** | Docker Compose | SaaS Signup | Complex Auth |

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Storage:** MinIO (S3 Compatible)
- **Deployment:** Docker Compose

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/gridworx/helios-client.git
cd helios-client

# Copy environment template
cp .env.example .env

# Start services
docker-compose up -d

# Access the portal
open http://localhost:3000
```

See [docs/guides/SETUP.md](docs/guides/SETUP.md) for complete setup instructions including Google Workspace service account configuration.

---

## License

**Business Source License (BSL) 1.1**

- **Free for internal use:** Run Helios for your organization at no cost
- **Source Available:** Code is open for inspection and audit
- **No Commercial Resale:** Cannot offer Helios as a managed service or resell without a commercial license

For commercial licensing inquiries, visit [gridworx.io](https://gridworx.io).
