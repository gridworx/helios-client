# Helios

**Self-hosted Google Workspace administration portal.**

> Open source. Free forever. Your server, your data, your control.

---

## What is Helios?

Helios is a web-based admin portal for Google Workspace. It gives you a modern UI for managing users, groups, email signatures, and more—while keeping all your data on your own infrastructure.

### Key Features

| Feature | Description |
|---------|-------------|
| **User Management** | View, search, edit users. Bulk import via CSV. |
| **Groups & Org Units** | Manage groups, membership, org structure. |
| **Email Signatures** | Dynamic templates with variables. Deploy directly to Gmail. |
| **Org Chart** | Visual reporting relationships. |
| **Lifecycle Automation** | Onboarding/offboarding templates and workflows. |
| **API Proxy Console** | Direct Google Workspace API access with full audit trail. |
| **Asset Sharing** | Proxy files from private Drive with branded URLs. |

### Why Self-Hosted?

- **Data Sovereignty** - Your data never leaves your infrastructure
- **No Per-User Fees** - One fixed cost, not $3-5/user/month like SaaS alternatives
- **Full Control** - Customize, extend, integrate however you want
- **Compliance Ready** - Every action logged for audit

---

## Quick Start

```bash
git clone https://github.com/gridworx/helios-client.git
cd helios-client
cp .env.example .env
docker compose up -d
```

Open http://localhost and complete the setup wizard.

> **Note:** First run builds the containers locally. For pre-built images, use:
> `docker compose -f docker-compose.prebuilt.yml up -d`

See [docs/guides/GOOGLE-WORKSPACE-SETUP-GUIDE.md](docs/guides/GOOGLE-WORKSPACE-SETUP-GUIDE.md) for Google Workspace service account configuration.

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Storage:** MinIO (S3-compatible)
- **Deployment:** Docker Compose

---

## Privacy & Telemetry

### What We Collect (If Enabled)

Telemetry is **disabled by default** for self-hosted instances.

If you choose to enable it, we collect:
- Instance health (version, uptime)
- Anonymous usage metrics (user count range, enabled modules)

We **never** collect:
- Your organization name or domain
- User names, emails, or any PII
- Your Google Workspace data

See [TELEMETRY.md](projects/helios-web/docs/TELEMETRY.md) for full details.

### How to Control Telemetry

```env
# In your .env file
HELIOS_TELEMETRY_ENABLED=false  # Default: disabled
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Helios Instance                         │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Frontend   │  │   Backend   │  │  Database   │              │
│  │  (React)    │──│  (Express)  │──│ (Postgres)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                          │                                       │
│                          │ Google Workspace API                  │
│                          ▼                                       │
│                   ┌─────────────┐                                │
│                   │   Google    │                                │
│                   │  Workspace  │                                │
│                   └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Optional telemetry (if enabled)
                          ▼
                   ┌─────────────┐
                   │ helios-web  │
                   │ (gridworx)  │
                   └─────────────┘
```

Your instance talks to Google Workspace using your own service account. Optionally, it can send anonymous health/usage data to helios.gridworx.io.

---

## Comparison

| Feature | Helios | BetterCloud/GAT | GAM (CLI) |
|---------|--------|-----------------|-----------|
| Data Location | Your Infrastructure | SaaS Cloud | Local Machine |
| Interface | Modern Web UI | Modern Web UI | Command Line |
| API Access | Full + Audited | Limited | Full |
| Audit Trail | Every Action Logged | Varies | Manual |
| Cost Model | Free or Fixed | $30-60/user/year | Free |
| Setup | Docker Compose | SaaS Signup | Complex Auth |

---

## Related Projects

| Project | License | Purpose |
|---------|---------|---------|
| **helios-client** (this) | MIT | Single-organization admin portal |
| [helios-mtp](https://github.com/gridworx/helios-mtp) | BSL | Multi-tenant portal for MSPs (coming soon) |

---

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](docs/guides/SETUP.md) | Complete setup guide |
| [GOOGLE-WORKSPACE-SETUP-GUIDE.md](docs/GOOGLE-WORKSPACE-SETUP-GUIDE.md) | Google Workspace integration |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | UI/UX guidelines |

---

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

```bash
# Run development environment
cd backend && npm run dev
cd frontend && npm run dev

# Run tests
npm test
```

---

## License

**MIT License** - Use it however you want.

See [LICENSE](LICENSE) for details.

---

## Support

- [GitHub Issues](https://github.com/gridworx/helios-client/issues)
- [GitHub Discussions](https://github.com/gridworx/helios-client/discussions)

If you find Helios useful, consider [sponsoring the project](https://github.com/sponsors/gridworx) to help fund continued development.

---

## The Story Behind Helios

Helios has been 8 months in the making, with multiple complete restarts along the way.

As a Google Workspace admin, I've always wanted a better way to manage users, groups, and
permissions without paying $30-60/user/year to SaaS vendors or trusting third parties with
domain-wide admin access to my organization's data. The security risk of having service
account credentials scattered across multiple computers, the lack of audit trails, the
compliance gaps - it all bothered me.

I'm not a programmer. I had the vision and the requirements, but not the skills to build it.

My journey through AI-assisted development:
- **2 months with OpenAI** - got started, learned the basics
- **3 months with Windsurf and Cursor** - made real progress, learned a lot about spec-driven
  and test-driven development. This is also where I finally put into practice what I already
  knew but hadn't used properly: GitHub workflows, branches, pull requests, .env files,
  .gitignore. But I kept hitting walls where every fix seemed to break something else, and
  getting back to working took longer each time.
- **3 months with Claude** - this is where it clicked. Biggest progress with minimal regression.

You might wonder why I didn't use Lovable, Replit, or similar cloud-based AI development
platforms. The answer is the same reason I built Helios: I don't trust what I don't know
how to secure. Having my entire codebase and files I'd normally gitignore living on someone
else's servers didn't sit right with me - especially when testing meant uploading Google
service account credentials to their cloud.

(You might also notice there's no commit history. During my learning phase, I accidentally
overshared things that shouldn't be in version control. Lesson learned.)

### What Works Today

**The Developer Console (API Relay) is solid.** Power users can access Google Workspace APIs
directly through Helios with full audit trails. Everything you can do with the Google Admin
SDK, you can do here - but every action is logged with who did it, when, and what changed.

**Security benefit:** Your service account JSON or P12 credentials live in one secured place
(Helios), encrypted in the database, instead of being copied to every admin's laptop,
contractor's machine, or scattered across automation scripts. One credential, full audit
trail, easy revocation.

**External access with accountability:** Service providers and automation tools can access
your Google Workspace through Helios API keys with configurable expiration. Every action
is attributed - you'll know exactly what your MSP or custom script did, when, and who
authorized it.

**The UI is a preview of my vision.** Several features aren't fully working yet. I've disabled
the incomplete ones by default - you can enable them in Settings > Feature Flags if you want
to explore.

### What Helios Changes

Most Google Workspace admin tools treat essential security features as premium upsells:
- **Audit logs?** Enterprise tier.
- **SSO/SAML?** Enterprise tier.
- **API access?** Enterprise tier.
- **Compliance exports?** Enterprise tier.

Helios flips this. **Auditability and compliance are the default, not add-ons.**

Every action is logged. Every API call is attributed. Every change is traceable. Not because
you paid extra - because that's how admin tools should work.

If you're a 10-person company or a 10,000-person enterprise, you deserve to know who did what
and when. Security shouldn't be a luxury feature.

### My Dream for Helios
- Put control back in admins' hands
- Eliminate scattered service account credentials (JSON/P12 files on multiple machines)
- Full audit trail for every action - internal users, contractors, service providers
- Grant external tools API access without giving away your credentials
- Make enterprise-grade compliance accessible to everyone

### Not What You're Looking For?

If you need a mature, fully-featured solution today, check out these excellent projects that
inspired me: [GAM](https://github.com/GAM-team/GAM) and [PSGSuite](https://github.com/SCRT-HQ/PSGSuite).
Or explore the many paid services out there.

Helios is early, it's rough around the edges, and I can't promise when I'll get back to it.
But this is my first contribution back to the open source and IT admin community, and I hope
it's useful to someone - or at least inspires you to build the thing you've been imagining.

— Michael Agu

---

## About

Built by [Michael Agu](https://github.com/michaelagux) / [Gridworx](https://gridworx.org)

Contact: [info@gridworx.org](mailto:info@gridworx.org)
