# CarePaws

A pet shelter adoption and welfare management platform, rebuilt for
production use by a real shelter. Three cooperating codebases:

| Codebase | Role | Stack |
|---|---|---|
| [`lykasServer`](./lykasServer) | REST + real-time API | Node.js / Express 5 / MongoDB / Redis |
| [`lykasAdmin`](./lykasAdmin) | Staff console | React 19 / Vite / TypeScript |
| [`lykasUser`](./lykasUser) | Mobile app for adopters/fosters/volunteers | Expo / React Native |

Each has its own README with full setup instructions. This file is the
map between them.

## Quick start (backend + admin panel, local dev)

```bash
docker compose up
```

This brings up MongoDB, Redis, the API (`http://localhost:5000`), and
the admin panel (`http://localhost:5173`) together. See
[`docker-compose.yml`](./docker-compose.yml).

The mobile app isn't part of this compose stack — Expo/EAS builds
natively and doesn't containerize. Run it separately:

```bash
cd lykasUser
cp .env.example .env   # EXPO_PUBLIC_API_URL=http://localhost:5000 for a simulator;
                        # use your machine's LAN IP for a physical device
npm install
npx expo start
```

## How the pieces fit together

- **Auth**: a single JWT contract (short-lived access token + rotating
  refresh token) issued by `lykasServer`'s `/api/auth/*` routes, consumed
  identically by both frontends' Axios interceptors
  (`lykasAdmin/src/services/api.ts`, `lykasUser/utils/api.ts`) — same
  401-triggers-refresh-then-retry logic in both, adapted for
  `sessionStorage` (web) vs. `expo-secure-store` (native).
- **Real-time**: Socket.io runs on the same HTTP server as the REST API.
  Both frontends connect with the same JWT at the handshake. Mobile
  users auto-join their own room; admin staff must explicitly emit
  `joinAdmin` (see `lykasAdmin/src/pages/Chat.tsx`) to receive live
  messages in the staff console.
- **CORS**: `lykasServer`'s `FRONTEND_URL` env var (comma-separated)
  controls which origins the admin panel can call the API from in
  production. Requests with no `Origin` header (server-to-server calls,
  the payment webhook) are allowed through unconditionally — this is
  intentional, documented in `lykasServer/src/server.js`.
- **File uploads**: both frontends upload directly to the backend
  (`multipart/form-data`), which streams to Cloudinary and returns a
  hosted URL. MIME-type allowlists are enforced server-side
  (`lykasServer/src/middleware/uploadMiddleware.js`) — a photo picker on
  either frontend can't bypass this by lying about a file's extension.
- **Payments**: `lykasUser` initiates checkout via
  `POST /api/payments/create-checkout` and opens the returned PayMongo
  URL; the gateway calls back to `lykasServer`'s webhook
  (signature-verified against the raw request body, not a
  re-serialized one — see the comment in `paymentController.js` for why
  that distinction matters); `lykasUser`'s `app/payment/success.tsx` and
  `app/payment/cancel.tsx` are the deep-link landing screens.

## Repo-wide conventions

- **API error envelope**: every endpoint returns
  `{ success, message, data? }` (or `{ success: false, message, errors?
  }` on validation failure). Both frontends' `getApiErrorMessage()`
  helpers know how to unwrap this — use them instead of reaching into
  `err.response.data` directly in new code.
- **Soft delete**: `isDeleted`/`deletedAt`/`deletedBy` is the default
  delete pattern across the backend (`Pet`, `User`, `Volunteer`,
  `InKindDonation`) — a `DELETE` archives, `POST /:id/restore` brings it
  back, and only `super_admin` can hit a `/:id/permanent` endpoint where
  one exists.
- **Enums are the contract**: the Mongoose schema enum, the zod
  validator, and any frontend `<select>`/segmented-control options for
  the same field are meant to match exactly. If you add a status value,
  update all three, plus `openapi.yaml`.

## What's deliberately not implemented

A few things were left as explicit non-goals rather than half-built:

- **User impersonation** (`POST /api/auth/users/:id/impersonate`)
  returns `501` with an explanation — it's a high-risk feature that
  needs its own audit-trail design, not something to ship as a
  five-line afterthought.
- **Backups/migrations** (`/api/backups`, `/api/migrations`) record
  metadata and intent; they don't execute `mongodump`/`mongorestore`
  from inside an HTTP handler, which would be a bad pattern regardless
  of how convenient it sounds.
- The dev-only `GET /api/appointments/seed` helper from the original
  source is excluded entirely, not just hidden behind a flag.

## Testing across the stack

Each repo has its own suite (`npm test` in each), summarized here since
they add up: `lykasServer` covers the auth lifecycle, the full
application pipeline, the payment webhook (including signature
verification), the risk-assessment scoring algorithm, and the shared
query/pagination builder. `lykasAdmin` covers role-gating and both
pages the original source shipped as empty stubs. `lykasUser` covers
the chat REST/Socket.io merge race, auth screen error states, and
adoption-application form validation.

None of this was run end-to-end in the environment that built it — see
each repo's README for the specific caveat (no network access to
`npm install` for the backend/admin; native modules for the mobile
app need a real device or simulator regardless). Treat `npm test` in
each repo, run by you, as the actual gate before deploying.

## License

Not specified — add one before treating this as a real open-source or
commercial project.
