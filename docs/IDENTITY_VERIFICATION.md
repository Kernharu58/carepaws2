# Identity verification

One centralized identity check, shared by adoption and foster applications. An applicant verifies a government ID **once**.

## Three separate kinds of verification (never interchangeable)

| Kind | Proves | Stored in | Who decides |
|---|---|---|---|
| Email verification | Control of an email address | `User.emailVerified` | Automatic (link/code) |
| Identity verification | Staff reviewed the applicant's government ID | `User.identityVerificationStatus`, derived from ONE `UserDocument` (`type: government_id`) | `admin` / `super_admin` via the review endpoint |
| Application documents | Supporting documents for one application (address, income, ...) | `UserDocument` (other types) | Staff, per application, in Document Review |

## Model

- **Authoritative record:** one government-ID `UserDocument`, referenced by `User.identityDocument`.
- **`User.identityVerificationStatus`** is a cache of that record. Eligibility checks never trust the cache alone: `evaluateIdentity()` re-derives the status from the document, so a conflicting or tampered user row grants nothing.
- **`IdentityVerificationRecord`** is an append-only history (submitted, approved, rejected, resubmission requested, revoked, expired, superseded, withdrawn, image purged, reconciled, legacy migrated), with reviewer, time, reason, checklist and document reference. It is never updated or deleted by the app and holds no ID numbers, image content or URLs.
- **Statuses:** `unverified`, `pending`, `verified`, `rejected`, `resubmission_required`, `expired`. The transition table is in `src/config/identity.js` and enforced in the service (`assertIdentityTransition`). Documents additionally use `superseded` and `withdrawn` (history only).
- **Defence in depth:** the `User` model refuses to save or update identity fields unless the call comes from `identityVerificationService`.
- Code: `src/services/identityVerificationService.js` (all logic), `src/controllers/identityController.js`, `src/routes/identityRoutes.js`, `src/services/documentStorage.js` (private storage).

## Application eligibility (shelter policy)

`Settings.identityPolicy.{adoption,foster}` (changed via `PUT /api/settings/identity-policy`, admin only, audited):

| Value | Meaning |
|---|---|
| `before_submission` (default) | Verified identity is required to submit the application |
| `before_review` | May submit, but cannot advance beyond `submitted` until verified |
| `none` | Shelter does not require it |

Identity is re-checked on every stage advance and on final approval (an ID can expire or be revoked mid-process). **Rejecting** an application never needs identity. The client is never asked for, and never trusted on, an identity status. Error: `403` (submit) / `409` (advance) with `code: "IDENTITY_NOT_VERIFIED"`, `identityStatus`, and a plain-language `message`.

Email verification is checked independently (`requireVerifiedEmail`, `EMAIL_NOT_VERIFIED`). Staff creating an application for a walk-in are exempt from email but **not** from the identity check.

## Staff-assisted walk-in process

1. Staff member (`staff`, `admin`, `super_admin`) sights the applicant's physical ID and photographs/scans it.
2. `POST /api/identity/walk-in/:userId/documents` (multipart: `file`, `idType`, `expiresAt?`) uploads it on the applicant's account. The record is marked `staff_assisted`; the applicant is notified.
3. A **different** admin reviews it (four-eyes: the uploader cannot review their own upload, nobody can review their own ID).
4. Once verified, the staff member can create the application. Until then the API returns `IDENTITY_NOT_VERIFIED`.

## Review

Reviewers (`admin`, `super_admin` only; ordinary `staff` cannot see or decide on ID images) must:
1. Open the image (the server records that this reviewer viewed it; approval is refused otherwise).
2. Complete the checklist: readable, complete, acceptable ID type, name matches, photo consistent (may be N/A), not expired (N/A only for ID types without expiry), no visible alterations. Every item must pass to approve.
3. Confirm the expiry date printed on the ID (required for passport, driver's license, state ID).
4. Reject / request resubmission: a reason of at least 5 characters is mandatory and shown to the applicant.

Every decision stores `assessmentType: staff_visual_review` and the disclaimer: *a staff visual assessment, not forensic authentication, not a government-database check.* A verified ID can be revoked (reject / request resubmission on a verified record) with a reason.

## Replacement and deletion

- One pending ID per user (unique partial index; double-taps and concurrent uploads yield one `201` and one `409`).
- Same image as a verified/rejected one -> `DUPLICATE_FILE`.
- Verified and not near expiry -> `ALREADY_VERIFIED`. Within 30 days of expiry the applicant may upload a **renewal**; they stay verified until the new ID is approved, then the old record becomes `superseded`.
- A verified ID that supports the current identity cannot be deleted (`VERIFIED_ID_PROTECTED`). Withdrawing a pending upload deletes the image and keeps the record (`withdrawn`).
- Replacing keeps the old record, linked via `supersededBy`.
- The reviewer is warned if the exact same image was submitted from another account.

## Privacy and retention

- Files are stored in Cloudinary with `type: authenticated` (no public URL). Clients read files only through `GET /api/identity/documents/:id/file` (or `/api/documents/:id/file`), which authorises the caller, streams with `Cache-Control: no-store`, and logs reviewer views. No API response contains a file URL or storage details.
- Not logged: ID numbers (never collected), image content, file URLs.
- Image retention (`IDENTITY_IMAGE_RETENTION_DAYS_VERIFIED`, default **30**; `IDENTITY_IMAGE_RETENTION_DAYS_OTHER`, default **14**): the image is deleted by the daily `identity_image_retention` job; the decision record is kept. **If you change these values, update the privacy policy text in `lykasUser/app/legal.tsx`.**
- Daily `identity_expiry` job moves verified IDs past their expiry date to `expired` and notifies the applicant (expiry is also applied lazily on read).
- No biometric matching and no external identity service.

## API

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /api/identity/me` | any signed-in user | Own status, reason, expiry, history, allowed actions, shelter policy |
| `GET /api/identity/policy` | any signed-in user | Policy per application type |
| `POST /api/identity/documents` | any signed-in user (own account) | Upload / replace own ID |
| `DELETE /api/identity/documents/:id` | owner | Withdraw pending / remove image of a decided ID; verified ID protected |
| `POST /api/identity/walk-in/:userId/documents` | staff, admin, super_admin | Staff-assisted upload |
| `GET /api/identity/users/:userId` | staff, admin, super_admin | Status + history (no image) |
| `GET /api/identity/queue` | admin, super_admin | Queue (`status`, `page`, `limit`, `q`) |
| `GET /api/identity/documents/:id` | admin, super_admin | Detail, history, checklist, warnings |
| `GET /api/identity/documents/:id/file` | owner, admin, super_admin | Authorised file stream |
| `POST /api/identity/documents/:id/review` | admin, super_admin | `decision`: `approve` / `reject` / `request_resubmission` |
| `POST /api/identity/users/:userId/reconcile` | admin, super_admin | Repair cached status from the document |
| `PUT /api/settings/identity-policy` | admin, super_admin | Change policy (audited) |

Changed: `POST /api/documents` refuses `government_id` (`USE_IDENTITY_ENDPOINT`); `PUT /api/documents/:id/verify` refuses it (`USE_IDENTITY_REVIEW`) and no longer allows setting a document back to `pending`; `GET /api/documents` lists application documents only; `DELETE /api/documents/:id` follows the protected-delete rules for IDs; `PUT /api/auth/users/:id/verification` is **retired (410)**; `GET /api/auth/users/verification-queue` now reads the identity queue (reviewers only, no file URLs); `PUT /api/settings` only accepts `address`, `phone`, `email`.

## Verification matrix

| Role | Upload own ID | Upload for a walk-in | View ID image | See status | Approve / reject / request resubmission | Replace own ID | Delete own ID |
|---|---|---|---|---|---|---|---|
| Applicant (adopter / fosterer / volunteer) | Yes | No | Own only | Own | No | Yes (rules above) | Pending / decided only; verified is protected |
| Staff | Yes (own) | Yes | **No** | Yes (status/history only) | **No** | Yes (own) | Same as applicant |
| Admin | Yes (own) | Yes | Yes (logged) | Yes | Yes (not own, not own uploads) | Yes (own) | Same as applicant |
| Super admin | Same as admin | | | | | | |
| Anonymous | No | No | No | No | No | No | No |

## Migration (existing databases)

```
node scripts/migrate-identity-verification.js                       # dry run, prints counts
node scripts/migrate-identity-verification.js --apply
node scripts/migrate-identity-verification.js --apply --move-files  # needs Cloudinary credentials
```
Run it before (or immediately after) deploying, then restart: the new "one pending ID per user" index cannot build while a user has two pending IDs; the script resolves those. It unlinks IDs from applications, links each user to their authoritative ID, re-derives statuses (**a user marked `verified` with no reviewed ID document becomes `resubmission_required`**), writes a `legacy_migrated` history record, sets retention dates, and with `--move-files` moves legacy public files to authenticated delivery. Idempotent; output contains counts only.

## Manual testing

1. Start API + admin + mobile. Register two applicants (A, B) and promote two users to `admin` (R1, R2) and one to `staff`.
2. A: try to apply to adopt -> blocked with a prompt to verify. Documents -> upload a passport photo with an expiry date -> status "Waiting for staff review".
3. A: upload again -> refused (already pending). Withdraw -> back to unverified. Upload again.
4. R1: Identity Verification -> open A's ID (image loads) -> Approve is disabled until every checklist item passes -> Reject with no reason is refused -> Request resubmission with a reason.
5. A: sees the reason and a notification; uploads a different photo. R1 approves. A: status Verified; apply to adopt and foster both work.
6. Staff: upload an ID for walk-in B; confirm staff cannot open or decide on it; R1 approves it; staff can now create B's application.
7. R1 tries to approve the ID R1 uploaded for someone -> refused; R2 can.
8. A: try to delete the verified ID -> refused. Set the document expiry in the past and run the `identity_expiry` job (Scheduled Jobs) -> A becomes `expired`, notified, applications blocked; upload a replacement.
9. Check no API response or screen shows a file URL.

## Known limitations

- Review is visual. Nothing here proves an ID is genuine or belongs to the person presenting it.
- Cloudinary private delivery and the `--move-files` migration were not run against a live Cloudinary account (no credentials in the build environment); storage is mocked in tests.
- On a standalone MongoDB (no replica set) writes use guarded conditional updates rather than a transaction; a crash between the two writes is repaired by `reconcile`. Transactions were verified on a single-node replica set.
- Legacy verified IDs have no expiry date; they stay verified until re-reviewed.
- Application documents (proof of address, etc.) were moved to private storage for new uploads, but older ones remain on public URLs until `--move-files` is run.
- The retention days are configurable; the privacy text states the defaults.
