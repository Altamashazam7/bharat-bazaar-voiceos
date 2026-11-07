alter table public.businesses
  add column if not exists owner_user_id uuid
  references auth.users (id) on delete cascade;

update public.businesses
set owner_user_id = owner_id
where owner_user_id is null
  and owner_id is not null;

alter table public.businesses
  alter column owner_user_id set default auth.uid();

create index if not exists businesses_owner_user_id_idx
  on public.businesses (owner_user_id);

alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.customers enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('businesses', 'products', 'orders', 'customers')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

create policy businesses_owner_user_access
  on public.businesses
  for all
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy products_business_owner_user_access
  on public.products
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = products.business_id
        and businesses.owner_user_id = (select auth.uid())
    )
  );

create policy orders_business_owner_user_access
  on public.orders
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = orders.business_id
        and businesses.owner_user_id = (select auth.uid())
    )
  );

create policy customers_business_owner_user_access
  on public.customers
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.businesses
      where businesses.id = customers.business_id
        and businesses.owner_user_id = (select auth.uid())
    )
  );

revoke all on table
  public.businesses,
  public.products,
  public.orders,
  public.customers
from public, anon;

grant select, insert, update, delete on table
  public.businesses,
  public.products,
  public.orders,
  public.customers
to authenticated;
