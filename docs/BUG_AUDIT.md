# CarePaws — Bug Audit

**Date:** 2026-11-16
**Scope:** Full monorepo — `lykasServer` (API), `lykasAdmin` (staff web), `lykasUser` (mobile)
**Method:** Four parallel deep code reviews (backend security/core, backend business logic, admin frontend, mobile frontend). Highest-impact items were re-verified directly in source (marked ✅).

Severity legend: **Critical/High** = security, data loss, or broken core features · **Medium** = correctness, races, validation · **Low** = polish / edge cases.

Tags: `[Server]` `lykasServer` · `[Admin]` `lykasAdmin` · `[Mobile]` `lykasUser`.

---

## Critical / High

### H1 ✅ [Server] Client-controlled payment amount
- **Where:** `lykasServer/src/controllers/paymentController.js:75-98`; `lykasServer/src/validators/payment.schema.js:6`
- **Bug:** `createCheckout` takes `amount` straight from `req.body` for `adoption_fee` / `event_fee` and never derives the expected fee from `refModel` / `refId` (no fee lookup exists anywhere). A user can pay ₱0.01 for an adoption fee and the webhook marks the Payment `paid`.
- **Fix:** Compute the fee server-side from the referenced Application/Event; only allow free amounts for `donation`.

### H2 ✅ [Server] Chat read-tracking is silently dead
- **Where:** `lykasServer/src/models/Message.js:3-11`; `lykasServer/src/controllers/messageController.js:26,55-57`; `lykasServer/src/server.js:232`
- **Bug:** The schema has no `isRead` / `readAt` paths, but messages are created with `isRead:false` and the controller aggregates/updates it. Mongoose strict mode strips the field → `unreadCount` is always 0 and mark-read is a no-op.
- **Fix:** Add `isRead: { type: Boolean, default: false }, readAt: Date` to the schema.

### H3 ✅ [Server] Risk-assessment update always 500s
- **Where:** `lykasServer/src/controllers/riskAssessmentController.js:87`; `lykasServer/src/models/RiskAssessment.js:11-18`
- **Bug:** `assessment.scores.toObject()` — `scores` is a *nested* path (no `type` wrapper), so `doc.scores` is a plain object without `.toObject()` → TypeError on every PUT that includes scores. (The scoring pre-save hook itself is correct.)
- **Fix:** `assessment.scores = { ...assessment.scores, ...req.body.scores }`.

### H4 ✅ [Admin] Editing content wipes its body (data loss)
- **Where:** `lykasAdmin/src/pages/ContentManagement.tsx:38-50,61`; server `lykasServer/src/routes/contentRoutes.js:62`
- **Bug:** `openEdit` sets title/type/isPublished but never `setBody(item.body)`. Submit PUTs `{title, type, body, isPublished}` with stale/empty `body`, and the server does `Object.assign(item, req.body)` → editing any content item erases its body.
- **Fix:** `setBody(item.body ?? "")` in `openEdit` (or omit unchanged fields from the PUT).

### H5 [Server] Google OAuth doesn't check `email_verified`
- **Where:** `lykasServer/src/controllers/authController.js:187-221`
- **Bug:** `googleAuth` trusts `payload.email` without checking `payload.email_verified`, auto-links to any existing account by email, and flips `emailVerified=true`. A Google token for an unverified email enables account takeover of a password account.
- **Fix:** Reject `payload.email_verified !== true`.

### H6 [Server] Foster end/cancel strands the pet forever
- **Where:** `lykasServer/src/controllers/fosterController.js:386-390,481`; `lykasServer/src/models/Application.js:78-81`; `lykasServer/src/controllers/applicationController.js:203-209,248,401`
- **Bug:** `end()` / `cancel()` set the pet Available/Adopted but never close the foster Application (stays `approved`). The partial unique index + active-application check then permanently block any new application for that pet; approved applications can't be rejected or deleted. A returned foster pet can never be re-homed.
- **Fix:** Mark the application completed/closed in `end()` / `cancel()`.

### H7 [Server] Public appointment list leaks volunteer PII
- **Where:** `lykasServer/src/routes/appointmentRoutes.js:46-53`
- **Bug:** `GET /` has no `protect` and returns full documents including `registrations[].phone`, `emergencyContact`, `notes`.
- **Fix:** Require auth, or strip registration PII from the public projection.

### H8 [Server] Extended foster placements drop out of monitoring
- **Where:** `lykasServer/src/jobs/reminderJobs.js:140`; `lykasServer/src/controllers/fosterController.js:286`
- **Bug:** The job filters `trialDurationDays: { $gte: 30, $lte: 60 }`, but `extend()` raises `trialDurationDays` to base+extension (up to 90). Extended placements get no missing/overdue report records, no reminders, and stale counters.
- **Fix:** Filter on `trialDurationDays - extendedDays` (or `$gte: 30` only).

### H9 ✅ [Admin] + [Mobile] Chat socket never recovers from token expiry
- **Where:** `lykasAdmin/src/pages/Chat.tsx:44`; `lykasUser/app/(tabs)/chat.tsx:65,72-73`
- **Bug:** Socket created with a static `auth: { token }` captured once. Access tokens live 15m (`lykasServer/src/utils/tokens.js:6`); on any reconnect the server rejects the stale token and socket.io retries forever with it. `connect_error` only sets `connected=false` → chat silently dies until remount. Both `RealtimeContext`s already do this correctly (auth callback + refresh-then-reconnect).
- **Fix:** Use `auth: (cb) => cb({ token: <current token> })` reading the live token, plus denied-handshake recovery.

### H10 ✅ [Mobile] Post-login `/me` can bounce the user back out
- **Where:** `lykasUser/context/AuthContext.tsx:57-99`
- **Bug:** `skipLoadMeOnce` is reactive state in `loadMe`'s deps, and the effect depends on `loadMe`. Login sets the flag → effect runs → flag consumed (`setSkipLoadMeOnce(false)`) → `loadMe` identity changes → effect runs a *second* time and performs a full `/api/auth/me`. Any failure does `setUser(null)` unconditionally → a just-logged-in user is bounced to login on a connectivity blip. The "skip" only delays the fetch by one render.
- **Fix:** Consume a ref inside `loadMe` (not reactive state); don't null the user when a fetch fails right after a successful login.

---

## Medium

### [Server]

- **M1 — Webhook never verifies paid amount/currency.** `paymentController.js:212-237` marks the Payment `paid` without comparing `paymentAttributes.amount` / `currency` to the stored `payment.amount`. Even after H1, mismatches go undetected. *Fix:* compare event amount to stored amount before transitioning.
- **M2 — Refresh-token rotation race + no reuse detection.** `authController.js:242-258` does `findOne({revoked:false})` → mutate → `save()` (non-atomic). Two concurrent requests both mint sessions; a replayed *revoked* token gets 401 without revoking the family. *Fix:* atomic `findOneAndUpdate({refreshTokenHash, revoked:false}, {revoked:true})`; on reuse of a revoked token, revoke all the user's sessions.
- **M3 — Socket handshake skips blacklist/status/role checks.** `server.js:181-196` only does `jwt.verify`; never checks `TokenBlacklist`, `user.isDeleted`, `user.status`, and takes `role` from the token. Logged-out/suspended/demoted users keep live `staff_room`/`admin_room` access for the token lifetime. *Fix:* mirror `protect()` at handshake.
- **M4 — Unescaped `q` → `$regex` (ReDoS + 500).** `utils/queryBuilder.js:16-20`, public via `GET /api/pets` (`petRoutes.js:10`, `petController.js:37`). Catastrophic backtracking can pin MongoDB CPU; invalid regex throws 500. `inventoryService.js:11` and `identityVerificationService.js:883` already escape correctly. Also `from/to` (lines 31-32) accept invalid dates → CastError 500. *Fix:* escape regex metacharacters; validate dates.
- **M5 — Staff can suspend/delete super_admins.** `authRoutes.js:51,56-57` + `authController.js:591-644`: `updateUserStatus`, `deleteUser`, `restoreUser`, `forceReset` are `adminOnly` (includes plain `staff`) with no target-role guard. *Fix:* forbid modifying users with role >= actor's role.
- **M6 — Occupancy counts adopted/fostered-out pets.** `utils/shelterOccupancy.js:6,49,67-69` counts every non-deleted pet with `shelterId`; nothing clears `shelterId` on adoption/foster, cages released only manually. Capacity fills with pets that left → blocks intake. *Fix:* count only `status: { $in: ["Available","Pending"] }`; auto-release cages on adoption.
- **M7 — Foster unique index contradicts controller.** `models/Foster.js:83` makes `application` unique across all statuses (partial `$exists` filter is vacuous since the field is required), while `fosterController.js:103` only blocks *active* duplicates → E11000 500 on re-placement. *Fix:* partial filter `status: "active"`.
- **M8 — Check-then-act overbooking races (no atomic guard/transaction).** Cage capacity (`shelterCareRoutes.js:183-190`, `cageManagement.js:58`), shelter capacity (`shelterOccupancy.js:53-77`), pickup double-booking (`adoptionPickupController.js:77-86`), interview/home-visit duplicates (`interviewController.js:33`, `homeVisitController.js:24` — no existing-scheduled check), cross-shift overlap (`appointmentRoutes.js:109`). *Fix:* copy the atomic pattern in `eventController.js:114-150`.
- **M9 — Multi-doc writes without transactions.** Application approve/reject + pet update (`applicationController.js:289-293,331-335`), foster `end()`/`cancel()` (`fosterController.js:382-390,479-481`), pickup `complete()` (`adoptionPickupController.js:158-165`). Partial failure leaves state inconsistent. *Fix:* reuse the identity service's `runInTransaction` pattern.
- **M10 — `complete()` / `noShow()` lack status guards.** `interviewController.js:111-126,171-178` and `homeVisitController.js:102-118,163-170` never check `status==="scheduled"` → cancelled/completed records can be (re)completed and advance the application. *Fix:* guard on current status.
- **M11 — Foster generic update unvalidated + counter drift.** `fosterRoutes.js:15` has no validator; `fosterController.js:206-221` lets staff change `startDate`/`expectedEndDate`/`trialDurationDays` without recomputing `weeklyReportsRequired` / due dates (bad dates → CastError 500). *Fix:* add zod validation + recompute.
- **M12 — Event-assignment routes bypass all rules.** `eventAssignmentRoutes.js:20-27,38-46`: POST/PUT accept raw `req.body` (no zod; PUT no `runValidators`) → arbitrary `status`, negative `hoursLogged`, re-pointing `event`/`volunteer`, bypassing cancelled-event/duplicate checks; duplicate key → 500. *Fix:* validate + reuse `assignVolunteer` rules.
- **M13 — Pet marked Adopted at approval, not handover.** `applicationController.js:58-63,290` sets `status:"Adopted"` + owner on approval; a later cancelled/no-show pickup (`adoptionPickupController.js:185-233`) leaves the pet Adopted and the application terminal. Contradicts `models/Pet.js:46-47`. *Fix:* set Adopted only at finalized handover.

### [Admin]

- **M14 — Notification delivered to wrong user.** `NotificationsAdmin.tsx:47-49` resolves recipient via `q=recipientEmail&limit=1` then `data[0]` with no exact-email check; server `q` is an unanchored regex. *Fix:* verify `user.email === recipientEmail` (case-insensitive) before sending.
- **M15 — Timezone bugs.** `Events.tsx:60` prefills datetime-local via `toISOString().slice(0,16)` (UTC, no offset) → editing shifts displayed/persisted time. `AdoptionScheduling.tsx:91,94`, `Interviews.tsx:59`, `HomeVisits.tsx:55`, `RiskAssessments.tsx` send naive `YYYY-MM-DDTHH:mm` parsed in server-local time. *Fix:* offset-adjust prefill (as `AdoptionScheduling.toLocalInput`) and send `.toISOString()` (Fosters does it right).
- **M16 — Paginated dropdown sources / guards.** `AdoptionScheduling.tsx:116-122` (double-booking guard + pickup options), `Interviews.tsx:90`, `HomeVisits.tsx:87`, `RiskAssessments.tsx:88` build selectors from only the first 20 rows → apps beyond page 1 unselectable; guard incomplete. *Fix:* fetch the full eligible set.
- **M17 — Stale-response races / missing cancellation.** `Health.tsx:145-147` discards `load`'s returned cleanup (`useEffect(() => { load(); }, [load])` should be `useEffect(() => load(), [load])`); `PetManagement.tsx:59-83`, `IdentityReviewModal.tsx:34-62`, `Fosters.tsx:204-212`, `Chat.tsx:82-96` lack per-id cancelled flags. *Fix:* per-id `cancelled` flag in each effect.
- **M18 — Unhandled GET rejections.** `Settings.tsx:23-28`, `PaymentsAdmin.tsx:24`, `AdoptionForm.tsx:69-97` use `.then().finally()` with no `.catch`. Settings is worst: failed load shows empty values and saving can blank shelter settings. *Fix:* `.catch` + error state; block save until loaded.
- **M19 — Health cage select has no empty/required option.** `Health.tsx:466-477,177`: `form.cageId` defaults `""` and `handleSave` skips empty values → record saved with no cage despite UI implying one. *Fix:* required select with placeholder, or include cageId explicitly.

### [Mobile]

- **M20 — Refresh request has no timeout.** `utils/api.ts:87` uses bare `axios.post` (no timeout) unlike the 20s `api` instance. On a black-holed connection `refreshInFlight` never settles → all queued 401 retries hang forever. *Fix:* pass `{ timeout: 20000 }`.
- **M21 — Payment landing screens pin the error view forever.** `app/payment/success.tsx:18-26,40` and `app/payment/cancel.tsx:17-25,43`: `load()` never calls `setError(null)`; one transient failure renders the error branch and later successes don't clear it. *Fix:* clear error on successful load.
- **M22 — Push-notification taps don't navigate.** `utils/pushNotifications.ts` has no `addNotificationResponseReceivedListener`; server sends `data:{type,refModel,refId}` and `utils/notifications.ts:56 getNotificationRoute` exists but is unused. *Fix:* register a response listener routing via `getNotificationRoute`.
- **M23 — Adopt search stale-response race.** `app/(tabs)/adopt.tsx:24-48`: 300ms debounce cancels the timer but not in-flight requests; no ordering guard → an older slow response can overwrite newer results. `app/pets/[id].tsx:47-74` has the correct `requestRef` pattern. *Fix:* add a request-ordering guard.
- **M24 — Chat history failure hides the whole conversation.** `app/(tabs)/chat.tsx:45-46,132-133`: `loadHistory` (also fired on every reconnect) sets `error`, and the error branch replaces the list even when messages exist; live messages merge invisibly. *Fix:* show full error view only when `messages.length === 0`; otherwise a banner.

---

## Low

### [Server]
- **L1** Stored HTML injection in receipt — `paymentController.js:368` interpolates user `description` unescaped (owner-only → mostly self-XSS). *Fix:* HTML-escape.
- **L2** Webhook timestamp not freshness-checked — `paymentController.js:166-181` uses `t=` in HMAC but never validates against now (event-ID idempotency largely neutralizes). *Fix:* ±5-min tolerance.
- **L3** No TTL on `Session` — `models/Session.js:11-18` `expiresAt` has no TTL index (unlike `TokenBlacklist.js:20`); expired sessions accumulate. *Fix:* add TTL index.
- **L4** CORS/socket fail-open by env — `server.js:76-78,176`: if `NODE_ENV !== "production"` any origin is allowed with credentials; socket CORS falls back to `origin:true` when `FRONTEND_URL` unset. *Fix:* fail closed in deployed envs.
- **L5** `?status=All` empties public catalog — `petController.js:38-39` re-applies literal "All" after the builder skipped it. *Fix:* drop the literal.
- **L6** `rejectedReason = undefined` is a Mongoose no-op — `userDocumentController.js:156`; stale reason survives rejected→verified. *Fix:* set `null` / `$unset`.
- **L7** Bare `z.string()` dates — `validators/interview.schema.js:8`, `homeVisit.schema.js:8`, `medicalRecord.schema.js:7,20,35` (no `Date.parse` refine, unlike `adoptionPickup.schema.js:3`) → 500 on garbage; pickups/interviews accept past dates. *Fix:* refine + future-date check.
- **L8** Appointment capacity double-counts legacy `user` — `appointmentRoutes.js:143-153` vs `:164-165`; `:255` resets a Completed shift to Open on edit. *Fix:* consistent counting; preserve status.
- **L9** `notifyOnce` counts deduped non-sends — `reminderJobs.js:206,220,336` returns the pre-existing notification (truthy) → inflated `itemsProcessed`. *Fix:* count only actual sends.

### [Admin]
- **L10** Tokens cleared on *any* refresh/loadMe error (even transient network) → logged out when briefly offline — `services/api.ts:57-60`, `context/AuthContext.tsx:38-40`. *Fix:* clear only on 401/403.
- **L11** New chat conversations dropped until reload — `Chat.tsx:57-58` ignores incoming message for a session not in the list (`idx === -1`). *Fix:* refetch sessions / insert placeholder.
- **L12** Draft cleared even on failed send ack — `Chat.tsx:105-108`. *Fix:* clear only on success.
- **L13** "Ends tomorrow" off-by-one — `Fosters.tsx:54` `days <= 1` renders "Ends tomorrow" when it ends today. *Fix:* `=== 0` → "Ends today".
- **L14** EXTEND skips client `vetAgreed` check — `Fosters.tsx:242-256` (server rejects, UX-only). *Fix:* validate client-side.
- **L15** FeedbackReviews modal not prefilled/reset — `FeedbackReviews.tsx:30,105` `status` defaults `"new"`, `response` not reset → can reset status / leak previous draft. *Fix:* prefill from item, reset on open.
- **L16** Orphaned retry timers — `context/RealtimeContext.tsx:69` overwrites `retryTimer` without clearing. *Fix:* `clearTimeout` before reassign.

### [Mobile]
- **L17** Success screen polls forever after terminal status / no-param dead end — `app/payment/success.tsx:28-32,14,19`. *Fix:* stop interval on `paid`/`failed`/`cancelled`; explain missing `paymentId`.
- **L18** Send clears draft before ack — `app/(tabs)/chat.tsx:98-105`; also silently no-ops when `connected` is false. *Fix:* clear on success; surface disconnected state.
- **L19** Malformed foster-report deep link → infinite spinner — `app/foster/report.tsx:31-54,84`: missing `fosterId` never calls `load()`, `loading` stays true. *Fix:* handle missing param.
- **L20** Notification toggle-off desyncs — `app/(tabs)/settings.tsx:102-127` + `utils/pushNotifications.ts:67-73`: `unregisterPushNotifications` swallows its PUT failure → switch shows off while server keeps sending. *Fix:* re-sync from `refreshUser` on failure.

---

## Verified sound (not bugs)

- **Webhook raw-body signature** — `express.json({verify})` (`server.js:90-99`) captures the true raw buffer; HMAC over `timestamp.rawBody` with `timingSafeEqual` is correct. The `JSON.stringify` fallback only triggers for non-JSON bodies and can't forge a signature.
- **JWT** — no secret fallback (missing `JWT_SECRET` throws); jsonwebtoken 9 rejects `alg:none`; password reset invalidates old access tokens via `passwordChangedAt` (`User.js:138-142`, `authMiddleware.js:43-48`).
- **Express 5 async errors** — rejected promises auto-forward; controllers also use try/catch + `next(err)`.
- **NoSQL operator injection via query** — Express 5's default `simple` query parser doesn't produce nested objects; auth/payment body inputs are zod-validated strings.
- **Axios 401-refresh interceptors (both frontends)** — shared in-flight promise + `_retried` flag + auth-path exclusions; no race/loop. Network-vs-invalid refresh handling correct.
- **Mobile REST/socket chat merge** — `chat.tsx:22-27` Map dedupe by `_id`, incoming wins, stable `createdAt` sort; server echoes to sender's room with `userId` set → no duplicates/lost own messages.
- **Admin role-gating** — `App.tsx` / `ProtectedRoute` / `Sidebar`, also enforced server-side.
- **Correct algorithms** — risk-scoring math, identity state machine, foster report sequencing/due-date math, event capacity reservation, pagination builder.
- **Mobile pickers/subscriptions** — image/video pickers handle permissions + cancellation; `PetVideoPlayer`, `RealtimeContext`, `UpdateBanner`, `AuthContext` AppState subscriptions clean up properly.
- **Note:** `zod` / `react-hook-form` / `@hookform/resolvers` are declared in `lykasUser/package.json` but unused — all mobile forms use manual validation (signup lacks client-side email-format check; server enforces).

---

## Suggested fix order

1. **Security first:** H1 (payment amount), H5 (OAuth takeover), H7 (PII leak), M3 (socket authz), M5 (staff vs super_admin).
2. **Data loss / broken features:** H4 (content body wipe), H2 (chat read tracking), H3 (risk-assessment 500), H6 (stranded foster pet).
3. **Reliability:** H9 (chat socket expiry), H10 (post-login bounce), M2 (refresh rotation), M8/M9 (races & transactions), M20 (refresh timeout).
4. **Correctness & polish:** remaining Medium, then Low.

> Reminder from the root README: none of the suites were run end-to-end in the build environment. Run `npm test` in each repo as the actual gate before deploying any fix.