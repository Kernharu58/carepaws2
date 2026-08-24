# lykasServer — CarePaws Backend

REST + real-time API for CarePaws, a pet shelter adoption and welfare
management platform. Node.js / Express 5 / Mongoose 9 / MongoDB, with
Socket.io for real-time chat and Redis-backed rate limiting/caching.

## Prerequisites

- Node.js 22+
- MongoDB (Atlas, or local via Docker Compose)
- Redis (required — rate limiting and caching depend on it; the app will
  refuse to boot without `REDIS_URL` set)

## Quick start (Docker Compose — recommended for local dev)

From the repo root (one level above this folder):

```bash
docker compose up
```

This brings up MongoDB, Redis, and the API together. The server will be
available at `http://localhost:5000`.

## Quick start (manual)

```bash
cp .env.example .env
# fill in MONGO_URI, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET at minimum

npm install
npm run dev        # nodemon, auto-restarts on change
# or
npm start           # plain node, for production-like runs
```

Health check: `GET http://localhost:5000/health`

## Environment variables

See `.env.example` for the full list with comments. At minimum for local
dev you need: `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
Everything else (Cloudinary, Google OAuth, email, PayMongo) degrades
gracefully or is only required for the feature that touches it — see the
inline comments in `src/utils/emailService.js` and
`src/controllers/paymentController.js` for exactly how each degrades.

**Never commit a real `.env` file.** Only `.env.example` (names, no
values) belongs in version control.

## Testing

```bash
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report
```

Tests use `mongodb-memory-server` (an in-process MongoDB), so they don't
touch your real database. Rate limiting (which needs a real Redis) is
mocked out in integration tests — see `tests/integration/auth.flow.test.js`
for the pattern.

## Linting

```bash
npm run lint
```

## Project structure

```
src/
  config/       — DB, Cloudinary, Redis connections
  middleware/   — auth, validation, rate limiting, uploads, error handling
  models/       — one Mongoose model per resource (see the project spec §5.2)
  routes/       — one router per resource, mounted at its real path (§5.3)
  controllers/  — route handler logic, 1:1 with routes/
  validators/   — zod schemas mirroring the Mongoose enums exactly
  utils/        — shared helpers (logger, query builder, email, tokens, audit log)
  jobs/         — node-cron job implementations
tests/
  unit/         — pure-logic tests (no DB writes needed, though the harness provides one)
  integration/  — supertest against the real Express app + in-memory Mongo
```

## Deployment

Three environments are expected: `development` (local/Docker Compose),
`staging` (a full clone of prod infra — separate Atlas cluster, separate
Cloudinary folder, separate PayMongo test keys, separate Redis instance),
and `production`. Set `NODE_ENV` accordingly — it affects CORS strictness,
log formatting (JSON in prod, pretty-printed otherwise), and Express's own
production optimizations.

Build the Docker image directly:

```bash
docker build -t carepaws-server .
docker run -p 5000:5000 --env-file .env carepaws-server
```

CI (`.github/workflows/ci.yml`) runs lint -> test -> `npm audit` on every PR
and push to `main`/`develop`/`staging`, and builds the Docker image on push.

## API documentation

See `openapi.yaml` (OpenAPI 3.1). This currently covers the routes built
in Phase 1 of the rebuild; it grows alongside the remaining resource
routers. Serve it with Swagger UI locally if useful — it's not exposed by
the running server itself.

## Delete pattern

The default delete pattern across the backend is **soft delete**:
`Pet`, `User`, `Volunteer`, and `InKindDonation` all carry
`isDeleted` / `deletedAt` / `deletedBy` fields, and their `DELETE` routes
set those instead of removing the document, with a corresponding restore
endpoint to reverse it.

**Exception: `Application` is hard-deleted** (`applicationController.js`'s
`deleteApplication`, via `Application.findByIdAndDelete`). This is
deliberate, not an oversight — see the comment on `deleteApplication` for
the reasoning. In short: an approved application can never be deleted
(blocked at the route), so only pending/rejected applications ever reach
the hard-delete path, and those don't carry the same retention need as a
completed adoption. If that changes, switch `Application` to the same
soft-delete pattern as the other models rather than inventing a
one-off mechanism.

## Notable production fixes vs. the original source

- **Redis is actually wired in** (`src/config/redis.js`) and backs all
  four rate limiters via `rate-limit-redis` — the original `redis`
  dependency was declared but never imported, so rate limits used to be
  in-memory-only and reset on every restart.
- **Short-lived access tokens (15 min default) + rotating refresh
  tokens**, replacing a single non-rotating 7-day JWT.
- **File uploads are validated by MIME type**, not just size
  (`src/middleware/uploadMiddleware.js`).
- **`Payment.type` supports `adoption_fee` and `event_fee`**, not just
  `donation`.
- **Push notifications are fully wired** (`src/utils/notificationHelper.js`)
  — every `notify()` call also sends an Expo push if the recipient has
  `notificationsEnabled` and a registered `pushToken`.
- **Chat REST fallback is a real route/controller module**
  (`src/routes/messageRoutes.js`), not inline in `server.js`.
