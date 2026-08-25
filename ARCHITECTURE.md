# Hakim Architecture Notes

Backend conventions for the multi-tenant clinic SaaS. Every new module MUST follow these rules.

---

## 1. Request pipeline (how a request is authorized)

```
Request
  │
  ├─ TenantGuard (GLOBAL)          x-tenant-slug header / subdomain
  │    → hospital must exist AND be active → req.hospitalId
  │    → suspended/unknown tenant = 404 before anything runs
  │    → routes marked @SkipTenant() bypass this (auth, /plans, platform-admin/*)
  │
  ├─ AuthGuard (route)             Bearer JWT (tenant realm)
  │    → req.user = { userId, role, hospitalId }   ← hospitalId baked at login
  │
  ├─ RolesGuard (route)            @AuthRoles('hospital_manager', ...) metadata
  │
  └─ TenantBindingGuard (route)    req.user.hospitalId === req.hospitalId ?
       → mismatch = 403 (cross-tenant access attempt)
```

Platform admins are a **separate realm**: `PLATFORM_JWT_SECRET`, `PlatformAuthGuard`,
always on `@SkipTenant()` routes under `/platform-admin/*`.

## 2. The two hospital-ID sources — and when to use each

| Source | Meaning | Use for |
|---|---|---|
| `@CurrentUser() user.hospitalId` | the hospital my **account** belongs to | operations on *my own* data (`/users/me`, my payments history) |
| `@CurrentHospital()` (`req.hospitalId`) | the **tenant context** this request addresses | operations on *the clinic* (branches, departments, doctors, schedules, appointments) |

On any `@AuthRoles()` route they are guaranteed equal by `TenantBindingGuard`;
the choice is semantic. Prefer:

- **Ownership** (me/my) → token claim.
- **Tenant targeting** (clinic resources) → decorator (it arrives pre-validated as active).

### ❌ Never allowed

Hospital IDs arriving from client bodies/query params. Only the two derived
sources above may scope a query. This was a real cross-tenant hole once — do not reopen it.

## 3. Query scoping rules (defense-in-depth)

Guards protect the edge; queries must still self-scope:

1. Every query touching tenant-owned documents includes `hospital_id` in the filter.
   ```ts
   // GOOD — scoped even if a guard were ever bypassed
   this.doctorModel.findOne({ _id: id, hospital_id: hospitalId });
   // BAD
   this.doctorModel.findById(id);
   ```
2. Identity is unique **per hospital**, not globally:
   - `User`: unique `(hospital_id, email)` and sparse `(hospital_id, phone)`
   - Same person MAY hold accounts in several hospitals.
3. Login/register/forgot-password/resend-verification resolve the tenant from
   the header — never from the body.
4. When a route takes `:id` of a tenant-owned resource, verify the loaded
   document belongs to `req.hospitalId` (see `PaymentService.uploadProof`).

## 4. Money rules (payments module)

- One `Payment` = one invoice covering one period (`period_start` → `period_end`).
  Monthly = +1 month, yearly = +12, computed UTC-safe (month-end clamped).
- `amount`/`plan_slug` are snapshots at invoice time — never mutate old invoices.
- Invoices are idempotent per `(hospital_id, period_start)` — backed by a unique index;
  cron and manual flows can overlap safely.
- Approval extends `hospital.currentPeriodEnd` **forward only** and reactivates
  suspended hospitals. Suspension (cron or manual via platform admin) cuts all
  tenant access instantly through `TenantGuard`.
- First period is recorded automatically when an application is approved
  (`provisionFirstCycle`) — proof reused from the reviewed application.

## 5. Module conventions

- Schema first (`schema/*.schema.ts`), Zod DTOs (`dto/*.dto.ts`, `createZodDto`),
  service, then controllers.
- Tenant controllers: `@AuthRoles(...)` per method; mutations usually
  `hospital_manager`. Platform controllers live in their own file
  (`platform-*.controller.ts`) inside the same module:
  `@SkipTenant() @UseGuards(PlatformAuthGuard) @Controller('platform-admin/<name>')`.
- Register every model the service injects in that module's
  `MongooseModule.forFeature([...])`. Populate works app-wide once any module
  registers the target schema.
- Pagination: inject the global `PaginationService`
  (`getPagination` / `buildPaginationMeta`); return `{ items, pagination }`.
- Response envelope: `{ success, statusCode, message, data }`.
- File uploads: `memoryStorage` via `multer.config.ts` (images) or
  `multer-proof.config.ts` (images + PDF), then `CloudinaryService.uploadFile(buffer, folder)`.

## 6. Onboarding lifecycle (reference)

```
Owner applies (plan ref + billingCycle + payment proof)
  → slug + plan validated at submit time
  → Platform admin approves
      → plan re-resolved by plan_id (fail-fast, nothing created if gone)
      → Hospital created (active)
      → Payment ledger opened: period #1 approved, invoice #2 pending
      → hospital_manager User created → set-password email
  → Manager invites doctors (email invite) · patients self-register under the slug
```

## 7. Environment knobs

| Key | Default | Purpose |
|---|---|---|
| `PAYMENT_GRACE_DAYS` | 7 | days past paid-through date before auto-suspend |
| `INVOICE_LEAD_DAYS` | 7 | generate next invoice this many days before period end |
| `PAYMENT_CURRENCY` | EGP | fallback currency for plans/invoices |

Daily billing cron runs at 01:00 (`payment.cron.service.ts`): mark overdue →
generate upcoming invoices → suspend expired hospitals.
