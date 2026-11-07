# Multi-tenant verification checklist

## Code and database controls

- [x] Product reads filter by the active `business_id`; create/update/delete use that ID.
- [x] Order reads filter by the active `business_id`; create/update/delete use that ID.
- [x] Analytics aggregate only orders returned by the business-scoped order query.
- [x] Admin metrics are derived from business-scoped product, order, and analytics services.
- [x] Retail access requires a Supabase Auth session. Business listings are limited by RLS.
- [x] Each business has an `owner_user_id` tied to Supabase Auth; registration sets it from the authenticated session.
- [x] Business lookup and switching only allow businesses owned by the signed-in user; explicit product/order business IDs are owner-validated before access.
- [x] Accounts without an owned business are routed to the ownership repair wizard for pilot admins when unassigned stores exist, otherwise to first-store setup; creation assigns ownership from the authenticated user and activates the new store.
- [x] Pilot Admin uses server-managed `app_metadata.pilot_admin` and protected database RPCs to list unassigned businesses and atomically assign verified ownership.
- [x] Phone login is disabled unless `VITE_ENABLE_PHONE_OTP=true`; when enabled it requires a linked existing phone identity rather than creating a separate user.
- [x] Auth diagnostics log auth state transitions, session restoration, login/signup/OTP outcomes, and the Supabase project host without logging credentials or contact details.
- [x] Supabase sessions persist across refreshes; the optional “Remember my email” preference stores only the normalized email address, never a password.
- [x] Signup with email confirmation disabled restores the newly created session and continues directly to first-business onboarding.
- [x] Auth forms validate email input, show signup password strength, and provide password visibility controls and success notifications.
- [x] Authentication debug panels are rendered only in Vite development mode.
- [x] Inventory is searchable, filterable, sortable, paginated, and supports CSV import/export with Supabase tenant-scoped writes.
- [x] Product images are stored as optional HTTP(S) URLs in the tenant-scoped Supabase products table; stock status distinguishes low and out-of-stock items.
- [x] RLS policies bind each business to its authenticated `owner_user_id`, and bind products/orders/customers to an owned business.
- [x] Legacy FastAPI inventory, order, invoice, and analytics endpoints return HTTP 410 rather than exposing shared JSON data.
- [x] Active business selection and business-scoped service access emit a debug log containing the active business ID.
- [x] Live voice orders use the active store's Supabase product catalog; voice parsing, invoice generation, and confirmation do not read/write shared JSON inventory or order files.

## Deployment and acceptance checks

- [ ] Apply all migrations in `supabase/migrations/` to the Supabase project before deploying the frontend.
- [ ] Apply `20261107000700_product_image_url.sql` before using product images or importing CSV files that include image URLs.
- [ ] Designate pilot admin(s) with server-managed `app_metadata.pilot_admin=true`. Verify owners out of band and repair remaining businesses through the Pilot Admin screen; do not assign unknown businesses to an arbitrary account.
- [ ] After every business has a verified owner, optionally validate `businesses_owner_user_id_required` and confirm no `owner_user_id` remains null.
- [ ] Confirm anonymous requests cannot read or write `businesses`, `products`, or `orders`.
- [ ] Create two test accounts and one business for each. Verify each account's business selector lists only its own store.
- [ ] Insert products and orders for both stores. Confirm account A cannot select, update, or delete account B's product/order by changing either the selected business ID or row ID.
- [ ] Confirm analytics and all Admin metrics for each account reflect only that account's data.
- [ ] Upload a voice order for each test account and verify product matching/pricing uses only that store's catalog and the saved Supabase order has that store's `business_id`.
- [ ] Confirm the legacy FastAPI routes `/inventory`, `/orders`, `/analytics`, and order detail/invoice routes return HTTP 410.

The client-side filters are defense in depth; RLS and the pilot-admin RPC checks are the authorization boundary. Deployment checks remain unchecked until the migrations are applied and verified against the hosted project.
