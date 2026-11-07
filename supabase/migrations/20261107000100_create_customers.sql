create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 7 and 20),
  created_at timestamptz not null default now()
);

create index if not exists customers_business_id_name_idx
  on public.customers (business_id, name);

alter table public.customers enable row level security;

create policy customers_owner_access
  on public.customers
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_id = (select auth.uid())
    )
  );

revoke all on table public.customers from public, anon;
grant select, insert, update, delete on table public.customers to authenticated;
