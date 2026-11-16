# CarePaws: Identity Verification Remediation Report

Final deliverables for the identity verification work across `lykasServer`, `lykasAdmin` and `lykasUser`.
Design details, API reference and the manual test script are in `docs/IDENTITY_VERIFICATION.md` (inside the project zip).

## 1. Confirmed issues discovered

| # | Issue found in the original code |
|---|---|
| 1 | `PUT /api/auth/users/:id/verification` let any staff member set a user to `verified` with no ID uploaded or reviewed, and no history. |
| 2 | `PUT /api/documents/:id/verify` had no review record, an optional rejection reason, and could set a document back to `pending` or overwrite another reviewer's decision. |
| 3 | `DELETE /api/documents/:id` hard-deleted verified IDs and erased all history. |
| 4 | Government IDs were stored on public Cloudinary URLs and `fileUrl` was returned in API responses. |
| 5 | `POST /api/applications` and the stage pipeline never checked identity. Staff-created applications had no identity check. |
| 6 | A government ID was linked to an application and treated as an "application document", which blocked the interview step. |
| 7 | Only `unverified/pending/verified/rejected` existed. There was no `resubmission_required` or `expired`, and an expired ID stayed `verified`. |
| 8 | `PUT /api/settings` copied the whole request body onto settings, so any staff member could change fields such as a policy. |
| 9 | The mobile app had no ID type, expiry, replacement flow, progress display or decision explanation. |
| 10 | About 15 backend test suites were broken by an outdated fixture (`acceptedTerms` missing), unrelated to identity. |

## 2. Files created

**Server (`lykasServer`)**
- `src/config/identity.js`
- `src/services/identityVerificationService.js`
- `src/services/documentStorage.js`
- `src/models/IdentityVerificationRecord.js`
- `src/controllers/identityController.js`
- `src/routes/identityRoutes.js`
- `src/validators/identity.schema.js`
- `src/jobs/identityJobs.js`
- `scripts/migrate-identity-verification.js`
- `tests/helpers/identity.js`
- `tests/integration/identity.verification.test.js`
- `tests/integration/identity.transactions.test.js`
- `tests/integration/identity.migration.test.js`

**Admin (`lykasAdmin`)**
- `src/components/identity/IdentityReviewModal.tsx`
- `src/services/identity.ts`
- `src/types/identity.ts`
- `tests/pages/UserVerification.test.tsx`

**Mobile (`lykasUser`)**
- `utils/identity.ts`
- `components/IdentityStatusCard.tsx`
- `__tests__/identity-verification.test.tsx`

**Docs**
- `docs/IDENTITY_VERIFICATION.md`

## 3. Files modified

**Server**
- Models: `User.js`, `UserDocument.js` (rewritten), `Settings.js`, `Application.js`, `Notification.js`
- Controllers: `authController.js`, `applicationController.js`, `interviewController.js`, `userDocumentController.js` (rewritten), `scheduledJobController.js`
- Routes: `settingsRoutes.js`, `userDocumentRoutes.js`
- Other: `server.js`, `cronJob.js`
- Tests: 17 existing test files (fixture fix); `application.pipeline`, `pipelineScheduling.stageConsistency`, `interview.homeVisit.access`, `pet.video`, `emailVerification` (verified-identity setup)

**Admin**
- `pages/UserVerification.tsx` (rewritten), `pages/DocumentReview.tsx`, `components/ui/StatusBadge.tsx`, `types/auth.ts`, `services/realtimeResources.ts`

**Mobile**
- `app/documents.tsx` (rewritten), `app/(tabs)/profile.tsx`, `app/pets/[id].tsx`, `app/legal.tsx`
- `context/AuthContext.tsx`, `components/StatusBadge.tsx`, `utils/notifications.ts`
- `__tests__/email-verification.test.tsx`

## 4. Database changes and migration

**Schema changes**
- `User`: statuses add `resubmission_required` and `expired`; new `identityDocument` (pointer to the authoritative ID) and `identityExpiresAt`. Direct writes to identity fields are blocked outside the service.
- `UserDocument`: new statuses (`resubmission_required`, `expired`, `superseded`, `withdrawn`); new fields `idType`, `storage`, `contentHash`, `submittedBy`, `submissionChannel`, `checklist`, `assessmentType`, `imageDeleteAfter`, `fileRemovedAt`, `supersededBy`, `reviewViews`. Unique partial index allows one pending government ID per user.
- New collection `identityverificationrecords` (append-only history).
- `Settings`: `identityPolicy.{adoption,foster}`.
- `Application`: `identityCheck` (which record was relied on, informational only).
- `Notification`: new `IDENTITY_*` types.

**Migration** (idempotent, dry run by default, prints counts only)
```
node scripts/migrate-identity-verification.js
node scripts/migrate-identity-verification.js --apply
node scripts/migrate-identity-verification.js --apply --move-files   # needs Cloudinary credentials
```
Run it before or right after deploying, then restart the server. A user marked `verified` with no reviewed ID document becomes `resubmission_required`.

## 5. API endpoints

**Added**

| Endpoint | Who |
|---|---|
| `GET /api/identity/me` | signed-in user |
| `GET /api/identity/policy` | signed-in user |
| `POST /api/identity/documents` | signed-in user (own account) |
| `DELETE /api/identity/documents/:id` | owner |
| `POST /api/identity/walk-in/:userId/documents` | staff, admin, super_admin |
| `GET /api/identity/users/:userId` | staff, admin, super_admin |
| `GET /api/identity/queue` | admin, super_admin |
| `GET /api/identity/documents/:id` | admin, super_admin |
| `GET /api/identity/documents/:id/file` | owner, admin, super_admin |
| `POST /api/identity/documents/:id/review` | admin, super_admin |
| `POST /api/identity/users/:userId/reconcile` | admin, super_admin |
| `PUT /api/settings/identity-policy` | admin, super_admin (audited) |
| `GET /api/documents/:id/file` | owner; staff for application documents |

**Changed**
- `PUT /api/auth/users/:id/verification`: retired, returns 410.
- `GET /api/auth/users/verification-queue`: now reads the identity queue, reviewers only, no file URLs.
- `POST /api/documents`: refuses `government_id` (`USE_IDENTITY_ENDPOINT`).
- `PUT /api/documents/:id/verify`: refuses `government_id` (`USE_IDENTITY_REVIEW`); never allows setting back to `pending`.
- `GET /api/documents`: application documents only.
- `DELETE /api/documents/:id`: government IDs follow the protected-delete rules.
- `POST /api/applications` and stage/status updates: identity gate (`IDENTITY_NOT_VERIFIED`).
- `PUT /api/settings`: accepts only `address`, `phone`, `email`.

## 6. Admin functionality

- Identity Verification page reads the queue from the backend, filterable by status (pending, resubmission required, rejected, expired, verified, all) and searchable.
- Review dialog: authenticated ID preview (never a public link), applicant information, ID type and expiry with a clear **expired** indicator, renewal and walk-in tags, duplicate-image warning.
- Seven-item checklist. Approve stays disabled until every item passes.
- Approve, reject, request resubmission, and revoke (on a verified record). A reason is mandatory for reject and resubmission.
- Verification history with reviewer name and timestamp, plus the staff-assessment disclaimer.
- The page never writes a status itself; every decision is a POST to the backend service.
- Document Review now handles application documents only; files open through an authenticated request.

## 7. Mobile functionality

- Identity card on the Documents screen showing the current status, why verification is required, the staff's reason, expiry and renewal hints.
- Upload flow: ID type, expiry validation, file picker, real upload progress, error messages, and recovery after a lost connection.
- Duplicate-submission protection (a second tap sends nothing), controlled replacement of rejected/expired IDs, withdraw a pending upload.
- Profile shows the live status and links to Documents. Identity notifications open the Documents screen.
- A pre-check before the application form sends an unverified applicant to verification (the server still enforces it).
- No file URL is ever rendered. The privacy policy text was updated to match the implementation.

## 8. Tests executed and actual results

| App | New identity tests | Whole suite |
|---|---|---|
| Server (Jest, real MongoDB 7.0.34) | **46 / 46 pass** (41 integration, 3 replica-set transaction, 1 migration, plus 1 storage guard) | 329 pass, 37 fail; **0 new failures vs. baseline** (baseline: 281 pass, 39 fail) |
| Admin (Vitest) | **14 / 14 pass** | 79 pass, 2 fail (`PetFields`, also fail on the original zip) |
| Mobile (Jest) | **27 / 27 pass** | 129 pass, 3 fail (sign-up screen, also fail on the original zip) |

- `tsc` is clean for admin and mobile; ESLint is clean for the touched server files.
- Mutation checks: removing the mandatory-reason rule and the duplicate-submit guard made the tests fail, as intended.
- The 37 remaining server failures are pre-existing and unrelated (for example one-character `displayName` fixtures, a missing `socket.io-client` dev dependency, a stale pagination test).

## 9. Verification matrix

| Role | Upload own ID | Upload for a walk-in | View ID image | See status | Approve / reject / request resubmission | Replace own ID | Delete own ID |
|---|---|---|---|---|---|---|---|
| Applicant | Yes | No | Own only | Own | No | Yes (rules in docs) | Pending/decided only; verified is protected |
| Staff | Yes (own) | Yes | **No** | Status/history only | **No** | Yes (own) | Same as applicant |
| Admin | Yes (own) | Yes | Yes (logged) | Yes | Yes (not own ID, not own uploads) | Yes (own) | Same as applicant |
| Super admin | Same as admin | | | | | | |
| Anonymous | No | No | No | No | No | No | No |

## 10. Remaining limitations

- Review is a staff visual assessment. Nothing here proves an ID is genuine or belongs to the person presenting it.
- Cloudinary private delivery and the `--move-files` migration were not run against a live account (storage is mocked in tests).
- The native mobile UI was tested with React Native Testing Library, not on a device.
- On a standalone MongoDB (no replica set) writes use guarded conditional updates instead of a transaction; a crash between two writes is repaired by the reconcile endpoint. Transactions were verified on a single-node replica set.
- Signed storage URLs are not time-limited. They are safe only because they are generated and fetched server-side and never sent to a client.
- Legacy verified IDs have no expiry date and stay verified until re-reviewed. Older application documents stay on public URLs until `--move-files` is run.
- Retention days are configurable (`IDENTITY_IMAGE_RETENTION_DAYS_VERIFIED`, default 30; `IDENTITY_IMAGE_RETENTION_DAYS_OTHER`, default 14). If you change them, update the privacy policy text in `lykasUser/app/legal.tsx`.
- Mobile `npm ci` needed `--legacy-peer-deps` in my environment.

## 11. Manual testing

See section "Manual testing" in `docs/IDENTITY_VERIFICATION.md` for the nine-step script covering two applicants, two admins and one staff member.
