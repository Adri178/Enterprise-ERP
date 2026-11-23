# Settings & Permissions

Company ADMINs manage access to their own Company at `/company-users`; `/access-audit` shows the corresponding change history. This is a single application User directory with Company memberships, not a tenant or subscription system. Only the active Company's ADMIN can query its directory or audit. MANAGER and VIEWER receive a read-only policy notice; browser-local demo mode does not simulate account administration.

## User workflow

1. Select an authorized Company in the header and open **Settings & Permissions → User & Akses**.
2. Choose an existing User by exact email, or create a new User with a name, initial password, fixed Role and reason. Email is trimmed and normalized to lowercase. There is no global User search or directory exposed to a Company ADMIN.
3. A new User must replace the initial password before accessing operational endpoints. The first login opens `/change-password`. After replacement, all previous sessions are invalidated and the User signs in again.
4. Edit another User's Role or access status with a reason. A confirmation shows the proposed changes. Inactive access can be reactivated through the same record; no membership or history is deleted.
5. Follow **Riwayat** to inspect dated grants and updates, their actor, reason and before/after values. The period uses Asia/Jakarta boundaries, with at most 366 days per query.

Granting an existing User does not change their global name, password, account status or other memberships. Deactivating a membership blocks only that Company. A globally inactive account cannot be reactivated through Company settings. There is no public signup, password reset by a Company ADMIN, or global account editor.

## Authorization and consistency

- Roles remain `ADMIN`, `MANAGER`, and `VIEWER`. ADMIN alone manages Company access. Existing operational policies remain in force, including ADMIN-only Stock Adjustment posting and Journal reversal, and different-User Leave Approval. This milestone does not introduce custom Roles or a per-module Permissions editor.
- Requests obtain the current User and Company membership from the database. Neither a JWT Role claim nor a client-selected Company grants authority. Every business write service rechecks active User, completed password onboarding, active membership, permitted Role and Company status inside its database transaction.
- Administrators cannot edit their own membership. Another ADMIN must make the change. Removing or demoting an active ADMIN must leave an active ADMIN who can log in; a new User still awaiting password replacement does not satisfy that condition.
- Membership writes lock the Company row and run at Serializable isolation. Concurrent ADMIN changes cannot both remove the final operational ADMIN. Stale `expectedUpdatedAt` values and serialization conflicts return 409; reload before retrying edits.
- Grants use a UUID request key unique within the Company. Retrying an identical successful request by the same actor returns the same membership; a different payload is rejected. A keyed HMAC protects request comparison, including initial credentials; neither the key nor its digest is returned to clients or audit views.
- Membership and audit changes commit atomically. Password changes and their self-only security events also commit atomically. API responses use `Cache-Control: no-store`; client requests bypass cached profile/access responses.
- Archived Company access and audit history remain readable to an authorized ADMIN, while writes are blocked. Membership deactivation does not delete business records or attribution.

Existing memberships retain their original Roles. In particular, the development admin is MANAGER in Beta and VIEWER in Gamma; these Companies are not silently given new ADMINs. A Company that had no ADMIN before this migration still requires an intentional database administration/bootstrap decision. The last-ADMIN policy governs application membership writes; it is not a database trigger against privileged manual database edits.

## Passwords and sessions

New passwords require at least 12 characters and at most 72 UTF-8 bytes, matching bcrypt's input boundary; NUL characters are rejected. Passwords are hashed with bcrypt cost 12. Password change requires the current password, a different new password, and matching confirmation. No plaintext password or password hash appears in directory responses or audit history. Delivering the initial password to the intended User is an administrator responsibility; no email delivery is implemented.

JWTs have a two-hour lifetime and carry a User session version. A successful password change increments the version, rejects every older JWT immediately on its next request, clears the current cookie and requires a fresh login. Legacy JWTs without a version work only while the stored version is zero. Login and password change each allow eight attempts per minute; general handler limits remain unchanged. Logout clears the current browser cookie; it does not increment the session version or revoke other devices.

Only authentication/profile, password change, self security history and logout endpoints are allowed during mandatory password replacement. All operational endpoints return 403 with `code: "PASSWORD_CHANGE_REQUIRED"`. Membership Roles/status are rechecked per request, so a previously issued JWT cannot preserve revoked Company access. The workspace refreshes memberships on focus, refresh and Company switching, and chooses another accessible Company before loading scoped data if access was removed. There is no live push mechanism; already displayed data can remain visible until refresh or the next request.

The full development seed intentionally resets the two base demo passwords and Roles and increments their session versions, invalidating their old sessions. The separate HR reviewer seed preserves an existing account. Do not reseed merely to manage access.

## REST API

All Company routes below require an active authenticated Company ADMIN. Read routes allow archived Companies; mutation routes require an active Company.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/companies/:companyId/access/users` | Company-only directory, operational ADMIN count and pagination |
| POST | `/api/companies/:companyId/access/users` | `NEW` User creation or `EXISTING` exact-email grant |
| PATCH | `/api/companies/:companyId/access/users/:userId` | Versioned Role/access update with reason |
| GET | `/api/companies/:companyId/access/audit` | Company access changes, optional member/action/date filters |
| POST | `/api/auth/change-password` | Current-password verification, replacement and session invalidation |
| GET | `/api/auth/security-events` | Current User's latest 20 account/password events |

Directory queries accept `q`, `role`, `status`, `page`, `pageSize` (1–100), `sort` (`name`, `email`, `role`, `createdAt`, `updatedAt`) and `direction`. Audit queries accept `from`, `to`, `userId`, `action` (`ALL`, `GRANT`, `UPDATE`) and bounded pagination. A foreign member filter is rejected. There is no arbitrary User selector for self security history.

An existing-account grant has this shape:

```json
{
  "mode": "EXISTING",
  "requestKey": "a180c680-e62b-4a98-a6b8-f7180e575a39",
  "email": "colleague@example.local",
  "role": "MANAGER",
  "reason": "Menangani operasional company"
}
```

`NEW` also requires `name` and `initialPassword`. Update requests contain `role`, `active`, `reason`, and the returned `expectedUpdatedAt`. URL Company scope takes precedence; global identity fields in a request cannot overwrite a User. Responses expose only safe directory fields, never credential or idempotency metadata. Validation errors use 400, invalid sessions 401, denied access 403, missing scoped records 404, and duplicate/stale/concurrent operations 409.

## Storage and UI decisions

The tenth migration adds soft membership status, timestamps, grant attribution and scoped idempotency indexes, plus User password-onboarding/session-version fields and self security events. Scoped membership relationships are retained. Legacy membership timestamps are backfilled to migration time; they are not reconstructed historical creation dates. Only new access changes produce audit entries; historic events are not fabricated. A pre/post-migration fingerprint confirmed that all previously stored columns and rows were preserved.

The existing compact workspace gains two Settings subpages without changing the primary navigation hierarchy. The directory uses explicit identity, Role, membership status and onboarding status columns; operational ADMIN count and the self-edit restriction remain visible. Destructive access changes use confirmation rather than row deletion. Existing-account mode asks only for an exact email and scoped permission, keeping global identity changes out of the Company flow. Date filters, paging, loading/error/empty states and Company reset follow the established list patterns. Copy lives in the shared Indonesian-English dictionary.

## Verification and remaining scope

Run `npm run test:permissions` against the dedicated development API/database. It creates disposable Companies and Users and removes only those fixtures. The API test covers forced onboarding, hashing, session invalidation, live Role changes, per-Company revocation/reactivation, direct-service checks, concurrent grants/ADMIN changes, protected global identity, private audit, stale edits and archived history. `npm run test:ui:live` includes the real forms, confirmation, password replacement and Company-switch audit scenario. Database-mutating suites must run sequentially; their Serializable predicates can conflict even with separate fixture Companies. Keep the production rate limits enabled and space login-heavy suites as needed.

Custom Roles, granular Permissions, configurable Approval policies, invitation/email delivery, recovery/MFA, a global account administrator, a device/session directory, token refresh and real-time revocation notifications remain pending. User-access administration does not complete the remaining Accounting, HR or Manufacturing extensions. See [verification](verification.md) for measured results and visual QA limits.
