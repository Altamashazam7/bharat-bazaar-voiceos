# Authentication and business ownership setup

## Deploy ownership repair

Apply migrations in `supabase/migrations/` in order, including
`20261107000400_auth_ownership_repair.sql`,
`20261107000500_require_business_owner.sql`, and
`20261107000600_pilot_admin_business_repair.sql`. The ownership migration
copies values from legacy `owner_id` where available. A business whose owner
is still unknown remains invisible to normal users; the `NOT VALID` constraint
allows those existing rows to remain while requiring owners for new or
modified rows.

Existing business repairs are completed in the app, not by asking users to
open the SQL editor. To authorize a pilot administrator, set
`pilot_admin: true` in that account's **Supabase Auth app_metadata** using a
trusted admin control (for example, the Supabase dashboard or Admin API).
This must be server-managed `app_metadata`, not user-editable `user_metadata`.
Have the admin sign out and back in so the claim is present in their access
token. The protected RPCs verify that claim before listing unassigned
businesses or assigning an owner.

The admin opens **Pilot Admin → Unassigned businesses**, independently
verifies the rightful owner, enters that person's existing Auth user UUID (or
chooses **Assign to me**) and confirms the repair. The database atomically
assigns only a row that still has no owner. No service-role key or per-business
SQL update is needed. Never infer ownership from a phone number, store name,
or a client-provided business ID.

Use the following read-only query to inspect businesses still requiring
verified assignment:

```sql
select id, name, owner_name, phone
from public.businesses
where owner_user_id is null
order by created_at;

select count(*) as unassigned_business_count
from public.businesses
where owner_user_id is null;
```

After all businesses have been repaired through the Pilot Admin screen, the
constraint can be validated as an optional deployment check:

```sql
alter table public.businesses
  validate constraint businesses_owner_user_id_required;
```

Confirm RLS is enabled and inspect the active policies and table grants:

```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('businesses', 'products', 'orders', 'customers')
order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('businesses', 'products', 'orders', 'customers')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('businesses', 'products', 'orders', 'customers')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

Expected: RLS is enabled on all four tables; `authenticated` has the required
CRUD table grants and is constrained by owner-based policies; `anon` has no
table grants. The `businesses` policy compares `owner_user_id` to `auth.uid()`;
child table policies resolve `business_id` through a business owned by that
same user.

## Supabase Auth dashboard settings

1. **Authentication → Providers → Email:** enable Email provider. For production,
   configure custom SMTP and use email confirmation. For controlled local
   acceptance testing only, confirmation can be disabled to allow immediate
   first-business setup; do not disable it as a rate-limit workaround in
   production.
2. **Authentication → URL Configuration:** set the production Site URL and add
   the local and production app callback URLs to Redirect URLs if confirmation
   or password-recovery links are used.
3. **Authentication → Rate Limits / SMTP:** configure a trusted custom SMTP
   provider and appropriate email sending limits. The built-in mail service is
   rate-limited; wait for its reset or use distinct test addresses when
   exercising signup.
   The application normalizes email casing/whitespace and uses the same
   configured Supabase client for registration and password sign-in. Auth
   development diagnostics show the Supabase project host and log action,
   result, error code, and status, but never log email, password, phone, or
   token. Supabase intentionally
   returns a generic invalid-credentials error for unknown email and wrong
   password; use Forgot password to recover access. Compare the logged project
   host with the Supabase project where the user was confirmed.
4. **Phone OTP is opt-in:** the frontend hides the phone login action and shows
   “Phone login unavailable in this deployment.” by default. To show it, set
   `VITE_ENABLE_PHONE_OTP=true` for a deployment, enable the Phone
   provider, and configure an SMS provider and its credentials/templates.
   Phone sign-in is configured not to create a new auth user. Link and verify
   the phone identity on the existing email account first, so OTP resolves to
   the same auth user UUID as `owner_user_id`. Otherwise, use email/password.
5. **Authentication → Policies:** ensure the application uses the `authenticated`
   role and the applied RLS policies remain enabled on businesses, products,
   orders, and customers. Never grant the browser the service-role key.

## Diagnosing the reported login failure

The application uses one configured Supabase client for email signup, email
confirmation callback detection, and password login. It now trims/lowercases
email consistently and explicitly enables session persistence, refresh, and
confirmation-link detection. That removes client-side email whitespace/case
inconsistency and restores confirmation sessions.

The reported `Invalid login credentials` response does **not** identify a
specific cause. Supabase intentionally uses a generic credential response so
the client cannot distinguish an unknown email from an incorrect password.
The repository does not have access to hosted Auth logs or user records, so
it cannot establish which one happened for a particular login. The auth log
shows the project host, action, error code, and HTTP status (no credentials or
contact information); compare that host with the project where the user
registered. Then check Email provider is enabled and use **Forgot password**
to recover credentials. A specifically reported `email_not_confirmed` gets a
separate message; a successful confirmation in another Supabase project does
not confirm this project's account.

## Acceptance checks

- Create User A and User B in the Supabase Auth dashboard (or sign up through
  the app). As User A, create a business, add one product and customer, and
  persist one voice order. As User B, create a separate business. Run
  [`supabase/tests/business_ownership_acceptance.sql`](../supabase/tests/business_ownership_acceptance.sql)
  after replacing its UUID placeholders with these fixture IDs and a known
  unassigned business ID. Both DO blocks must complete without raising an
  exception.
- Sign up with email confirmation disabled in a test project; verify the app
  routes to first-store setup after authentication, and that saving the
  required store details creates the first business, sets its owner and
  active ID, and opens the dashboard.
- With confirmation enabled, verify signup asks the user to confirm and sign
  in; after sign-in, a user with no owned business is routed to first-store
  setup.
- Create the first store and verify its `owner_user_id` equals the signed-in
  `auth.uid()` and the store becomes active.
- Sign in as a second user. Verify the first user's business is not listed or
  readable, including by requesting its ID directly from each retail table.
- Leave an existing business unassigned and verify it is absent to normal
  users. As a designated pilot admin, repair it through **Pilot Admin** and
  verify the business becomes available to the assigned account.
- With phone OTP disabled, verify no phone-login action appears and the email
  password path remains available. When enabled with a linked identity,
  verify the code flow resolves to the same owner user. If Supabase rejects the
  provider as unsupported, the app hides phone login for the rest of that
  browser session and points the user to email/password.
