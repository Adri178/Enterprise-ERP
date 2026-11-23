# Deploying at https://adzr.my.id/erp

> Deferred as of 3 November 2026. This is a historical subpath deployment guide, not the current local setup. Active local and example configurations use root routes. Follow the [design completion scope](design-completion.md) before resuming deployment work.

The ERP can remain in its own source directory while the portfolio stays at the domain root. A directory on disk is independent of the URL assigned by the hosting panel/reverse proxy. This configuration keeps Next.js App Router, static prerendering and client-side ERP data loading; no SPA-only conversion is required. Next.js supports domain subpaths through its [basePath configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath).

| Public address | Handler |
| --- | --- |
| `https://adzr.my.id/` | Existing portfolio |
| `https://adzr.my.id/erp` | ERP entry, redirecting within `/erp` |
| `https://adzr.my.id/erp/dashboard` | Next.js workspace |
| `https://adzr.my.id/erp/_next/...` | Next.js assets |
| `https://adzr.my.id/erp/api/...` | Next.js proxy to NestJS's internal `/api/...` |

The owner reports Node.js and PostgreSQL support. Inspection of the sibling `portfolio` source on 22 October 2026 found an Astro static website and a separate PHP/MySQL Gemilang application, with deployment instructions targeting cPanel. This identifies the documented panel family, not the active server configuration. The provider, allowed number of Node processes, startup model, PostgreSQL provisioning and proxy path behavior still need verification. See the [portfolio inspection and PostgreSQL setup guide](portfolio-hosting-audit.md). No public deployment, DNS change or portfolio modification has been performed.

The owner has since created a database/user and supplied fields matching CloudLinux **Setup Node.js App**. Use the [field-by-field Passenger guide](cpanel-nodejs.md) for that model: two `server.js` startup files, frontend `/erp`, API `/erp-api`, and an HTTPS API destination. The numeric-port commands below describe conventional process hosting; they must not be mistaken for Passenger socket configuration. Source support is implemented, but the server itself has not been accessed or verified.

## Application roots and processes

Keep source outside the portfolio's publicly served files, for example:

```text
home/account/
  portfolio/                  existing portfolio
  enterprise-erp/
    package.json
    package-lock.json
    apps/web/                 frontend application root
    apps/api/                 backend application root
    packages/shared/
    scripts/
```

This application currently uses **two persistent Node processes**: Next.js and NestJS, plus one PostgreSQL database. The panel must support two applications/processes or the API must run on a separately reachable Node service. NestJS deployment requires its compiled server to run; uploading a static folder alone does not run the backend. See the [official NestJS deployment guide](https://docs.nestjs.com/deployment).

For a panel that accepts commands, use:

| App | Working directory | Start command | Public routing |
| --- | --- | --- | --- |
| Frontend | `enterprise-erp/apps/web` | `npm run start` | `/erp` and all children, preserving the prefix |
| Backend | `enterprise-erp/apps/api` | `npm run start` | Internal address reachable from Next.js |

Managed panels may require a startup JavaScript file or assign their own ports/socket. Those details must be adapted to the actual provider; the commands above assume normal numeric ports. Do not point a startup-file field at a TypeScript source file. A Windows `.local/postgres` cluster and Windows `node_modules` are not deployment artifacts.

## Environment configuration

Use the hosting panel's environment settings, with [web production examples](../apps/web/.env.production.example) and [API production examples](../apps/api/.env.production.example) as templates. Supply real secrets through the hosting environment, not the repository or public portfolio directory.

Frontend, set before building and retain for startup:

```dotenv
NEXT_PUBLIC_BASE_PATH=/erp
NEXT_PUBLIC_DATA_MODE=live
API_URL=http://127.0.0.1:4010
```

API:

```dotenv
NODE_ENV=production
FRONTEND_ORIGIN=https://adzr.my.id
SESSION_COOKIE_PATH=/erp
API_HOST=127.0.0.1
PORT=4010
```

Also set `DATABASE_URL` to the deployment PostgreSQL database and `JWT_SECRET` to a newly generated random secret of at least 32 characters. Use the database provider's required TLS/connection parameters. `FRONTEND_ORIGIN` is an origin, so it has **no `/erp` suffix**. The API validates this at startup. `API_URL` is the server-to-server Nest address, not a browser environment variable. If the API is hosted elsewhere, it must be reachable from the frontend process.

`NEXT_PUBLIC_BASE_PATH` is compiled into browser bundles. Rebuild when changing the path; moving the built files to another folder does not change their URLs. Set `API_URL` before build as well, since rewrites are generated with the deployment configuration. Empty `NEXT_PUBLIC_BASE_PATH` and `/` cookie path preserve the original localhost/root setup.

Native browser fetches, including login/profile, use `/erp/api/...`. Next Link/router applies the page prefix. The API's own route prefix remains `/api`. Login, logout and password-change cookie clearing share `SESSION_COOKIE_PATH`, with HttpOnly, SameSite=Strict and Secure in production. No cookie Domain is set: the cookie belongs to the frontend domain that delivers the response. A `/erp` cookie is not sent to `/`, `/portfolio` or `/erpx`.

## Install and build

Run commands from the workspace root using a supported Node version (22.18+; this project was verified with Node 26). Install/build for the hosting operating system so Prisma's native engine matches it. Upload source, migrations, workspace package manifests and the lockfile; omit `.env` files, `.local`, existing `node_modules`, caches and development screenshots.

```sh
npm ci
npm run db:generate
node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
npm run build
```

Database/secret variables must already be supplied to the migration command. For builds performed on CI, install the resulting build/dependencies in a compatible target environment. Development seeds deliberately refuse `NODE_ENV=production`. After migrations/build, use the private interactive [initial ADMIN setup](initial-installation.md), `NODE_ENV=production npm run db:bootstrap`, on a new installation. It creates three empty fictional Companies and requires a first-login password change. It refuses existing installations and does not load operational fixtures. Do not use the published development accounts/passwords for a real installation.

Then start the two applications with the configured environment. The provider must route `/erp` **and every child path** to Next while preserving `/erp`, including `_next`, API, query strings and deep links. A panel that strips the mount path needs a suitable routing adjustment; otherwise a build expecting `/erp` will see the wrong request URL. The existing portfolio continues handling paths outside the ERP mount. The Next proxy forwards `/erp/api/...` to the internal Nest `/api/...`.

If the hosting plan cannot run the two processes or preserve the mount path, the deployment arrangement needs adjustment. A subdomain is another possible arrangement, but the requested `/erp` path remains the target. Provider-specific routing/startup instructions cannot be declared verified until the panel is identified.

## Verification and rollback

Before changing the portfolio route, deploy to a preview/staging mount and check the actual public HTTPS origin. Confirm `/erp/login`, a refreshed deep link, JS/CSS assets, login/Company switching and `/erp/api/auth/me`. Verify cookie Path `/erp`, Secure, logout/password-change clearing and that the portfolio root remains available. The locally verified build alone does not prove hosting-panel/proxy behavior.

The project includes `scripts/verify-subpath-build.mjs` to inspect a completed `/erp` production build without starting a server, and `scripts/verify-subpath.mjs` for a **development** prefixed preview, plus a live catalog UI scenario. Example after building with `/erp`, proxying to a local API configured with `/erp` cookie path, and starting a local preview on port 3001:

```sh
node scripts/verify-subpath-build.mjs
TEST_WEB_URL=http://localhost:3001/erp node scripts/verify-subpath.mjs
NEXT_PUBLIC_BASE_PATH=/erp TEST_WEB_URL=http://localhost:3001/erp node scripts/run-live-ui.mjs .local/test-build/web/test/catalog-live.integration.js
```

Compile the live test files first with `npm run test:ui` or `tsc -p apps/web/tsconfig.test.json`. The smoke script uses the development admin account and must not be pointed at a real installation. It checks all configured routes, assets, redirects, API scope/authorization, cookie path matching and clearing without logging session values.

This change requires **no database migration**. Keep the previous application build, routing and environment so the mount can be restored if login, assets or deep links fail. Changing the mount requires a corresponding rebuilt frontend and matching cookie path. Root-path installations can continue with an empty frontend base path and default `/` cookie path; host routing should distinguish the two builds. No new public installation is live yet.
