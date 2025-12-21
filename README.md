# Helios Client Portal

> **The Definitive Self-Hosted Google Workspace & Microsoft 365 Management Platform**

![Helios Dashboard](https://gridworx.io/assets/helios-dashboard-preview.png)

## 🚀 Overview

Helios is the **first and only** truly self-hosted, data-sovereign management platform for Google Workspace and Microsoft 365. Designed for security-conscious organizations and MSPs who demand control, Helios bridges the gap between powerful CLI tools (like GAM) and expensive SaaS platforms (like BetterCloud or GAT Labs).

**Why Helios?**
*   **Data Sovereignty:** Your data never leaves your infrastructure. No third-party SaaS has access to your user directory or emails.
*   **Cost Efficiency:** Stop paying $30+/user/year for SaaS. Helios is a fraction of the cost.
*   **Unified Management:** Manage Users, Groups, Licenses, and Assets from a single pane of glass.

---

## 🏆 Key Features

### 1. Advanced User Lifecycle Management
*Automate onboarding and offboarding like a pro.*
*   **Workflow Templates:** Define steps for New Hires, Leavers, and Role Changes.
*   **Scheduled Actions:** Pre-provision users or schedule access revocation.
*   **Cross-Platform Sync:** Create user in Google Workspace, assign Microsoft 365 license, and add to Slack in one click.

### 2. Enterprise Email Signatures (CodeTwo Alternative)
*Centralized control without the per-user cost.*
*   **Dynamic Templates:** Use variables (e.g., `{{JobTitle}}`, `{{Department}}`) to standardise signatures.
*   **Campaign Manager:** Schedule marketing banners ("See us at Booth #4") for specific teams/dates.
*   **Analytics:** Track click-through rates with built-in 1px tracking pixels.
*   **No Deployment Agents:** Direct API push to Gmail settings.

### 3. Smart Asset Proxy & Drive Management
*Securely share assets without public links.*
*   **Google Drive Proxy:** Share "Public" assets from a private Shared Drive via a branded URL (`assets.yourcompany.com/brochure.pdf`).
*   **Audit & Security:** Track who accesses files and when.

### 4. Admin/User Separation
*Empower employees without giving away the keys.*
*   **Self-Service Portal:** Allow users to update their profile, view org charts, and access resources.
*   **Strict RBAC:** Admins see everything; Users see only what they need.

---

## 🆚 Comparison

| Feature | Helios (Self-Hosted) | BetterCloud / GAT | GAM (CLI) |
| :--- | :---: | :---: | :---: |
| **Data Sovereignty** | 🔒 **100% On-Prem** | ❌ SaaS Cloud | 🔒 Local |
| **Interface** | ✨ **Modern UI** | ✨ Modern UI | 💻 Terminal |
| **Connectivity** | ⚡ **Real-time** | 🐢 API Polling | ⚡ Direct |
| **Cost** | 💰 **Low Fixed Cost** | 💸 High Per-User | 🆓 Free |
| **Setup** | 🐳 Docker Compose | ☁️ SaaS Signup | ⚙️ Complex Auth |
| **Licensing** | 🛡️ **BSL Protected** | 🔒 Closed Source | 🔓 Open Source |

---

## 🛠️ Stack

*   **Frontend:** React, TypeScript, Vite
*   **Backend:** Node.js, Express, TypeScript
*   **Database:** PostgreSQL
*   **Cache:** Redis
*   **Storage:** MinIO (S3 Compatible)
*   **Deployment:** Docker Compose / Kubernetes

---

## 📜 license

**Helios is released under the Business Source License (BSL) 1.1.**

### What this means:
*   ✅ **Free for internal use:** You can download, modify, and run Helios for your licensed organization freely.
*   ✅ **Source Available:** The code is open for inspection and audit.
*   ❌ **No Commercial Resale:** You **cannot** offer Helios as a managed service (SaaS) to third parties or sell it as a standalone product without a commercial license from GridWorx.

> *Protection against "copy-paste" MSPs: We built Helios to empower IT teams, not to be resold by unauthorized vendors.*

For commercial licensing, MSP partnership inquiries, or Enterprise support, visit [gridworx.io](https://gridworx.io).
