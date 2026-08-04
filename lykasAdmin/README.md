# lykasAdmin — CarePaws Staff Console

Internal web console for shelter staff and admins. React 19 / Vite /
TypeScript, styled with Tailwind CSS, talking to `lykasServer` over REST
and Socket.io.

## Prerequisites

- Node.js 22+
- A running `lykasServer` instance (see that repo's README)

## Quick start

```bash
cp .env.example .env
# set VITE_API_URL to your backend, VITE_GOOGLE_CLIENT_ID if using Google sign-in

npm install
npm run dev
```

Opens at `http://localhost:5173`. Sign in with a `staff`, `admin`, or
`super_admin` account — plain `user` accounts are rejected at login (this
is a staff tool, not a public surface).

## Environment variables

- `VITE_API_URL` — the backend's base URL.
- `VITE_GOOGLE_CLIENT_ID` — for the Google sign-in button on the login page.

Both are inlined into the built JS bundle at build time (that's how Vite's
`VITE_*` prefix works) and are visible to anyone who opens dev tools —
never put a real secret in a `VITE_` variable.

## Testing

```bash
npm test          # run once
npm run test:watch
```

Tests use `vitest` + `@testing-library/react` with a jsdom environment.
The `api` module is mocked at the network boundary in each test file
rather than hitting a real backend.

## Linting & typechecking

```bash
npm run lint
npx tsc -b --noEmit
```

`tsconfig.app.json` runs with `strict: true` — the build (`tsc -b && vite
build`) already fails on type errors, so CI just runs the same check
explicitly and earlier in the pipeline.

## Project structure

```
src/
  pages/          — one file per route, 40 total (see the project spec §7.2)
  components/
    layout/       — AppLayout, Navbar, Sidebar, ProtectedRoute
    ui/           — shared primitives: Button, Modal, DataTable, StatusBadge, ...
    pets/         — pet-specific pieces (cards, filters, add/edit modals)
    adoption/     — the reusable AdoptionForm component (distinct from pages/AdoptionForm.tsx)
    shifts/       — shift add/edit modals
    Community/    — VolunteerForm, DonationTracker
  context/        — AuthContext (session/role state), ToastContext (global notifications)
  hooks/          — useResourceList (generic list/pagination), usePets, useApplications
  services/       — api.ts: the shared Axios instance, token storage, error-envelope helper
tests/
  pages/          — page-level tests (PetManagement, AdoptionForm)
  components/     — component-level tests (ProtectedRoute role-gating)
```

## Deployment

Build the Docker image directly:

```bash
docker build -t carepaws-admin .
docker run -p 8080:80 carepaws-admin
```

The image is a two-stage build: `npm run build` produces a static bundle,
served by a minimal nginx config with SPA-style fallback routing (every
unmatched path serves `index.html`, since routing is client-side).

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build →
`npm audit` on every PR and push to `main`/`develop`/`staging`, then
builds the Docker image on push.

## Notable implementation details

- **The two pages the source shipped as empty 0-line stubs —
  `PetManagement` and `AdoptionForm` — are fully built out here.**
  `PetManagement` is a master-detail screen (pet list + full operational
  profile, pulling in shelter-care and medical summaries). `AdoptionForm`
  is a real create-application flow, composing a separate reusable
  `components/adoption/AdoptionForm.tsx` form component — the two files
  share a name but are different files with different jobs (see
  §12.4 of the project spec).
- **Chat explicitly joins `admin_room`** via a `joinAdmin` Socket.io
  event on mount — this is not automatic for staff sessions on the
  backend, unlike a regular user's own room.
- **Every routed page is wrapped in an error boundary**
  (`components/ErrorBoundary.tsx`) that also reports to
  `POST /api/errors/report`, so a crash in one page doesn't blank the
  whole app and still shows up in the admin panel's own error log.
- **Access tokens live in `sessionStorage`, not `localStorage`** — a
  deliberate tradeoff explained in `services/api.ts`: survives a page
  reload within the tab without persisting across browser restarts the
  way `localStorage` would.
