-- Replace every UUID placeholder with verified test fixture IDs, then run the
-- entire script in Supabase SQL Editor. The test accounts must each own one
-- business; User A should also have at least one product and order.
begin;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  'USER_A_AUTH_UUID',
  true
);

do $$
begin
  if auth.uid() <> 'USER_A_AUTH_UUID'::uuid then
    raise exception 'User A JWT claim was not applied';
  end if;

  if not exists (
    select 1 from public.businesses
    where id = 'USER_A_BUSINESS_UUID'::uuid
      and owner_user_id = auth.uid()
  ) then
    raise exception 'User A cannot read their owned business';
  end if;

  if not exists (
    select 1 from public.products
    where business_id = 'USER_A_BUSINESS_UUID'::uuid
  ) then
    raise exception 'User A product fixture is missing or unreadable';
  end if;

  if not exists (
    select 1 from public.orders
    where business_id = 'USER_A_BUSINESS_UUID'::uuid
  ) then
    raise exception 'User A order fixture is missing or unreadable';
  end if;

  if exists (
    select 1 from public.businesses
    where id in (
      'USER_B_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) then
    raise exception 'User A can read a foreign or unassigned business';
  end if;

  if exists (
    select 1 from public.products
    where business_id in (
      'USER_B_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) or exists (
    select 1 from public.orders
    where business_id in (
      'USER_B_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) or exists (
    select 1 from public.customers
    where business_id in (
      'USER_B_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) then
    raise exception 'User A can read another business product/order/customer';
  end if;
end
$$;

select set_config(
  'request.jwt.claim.sub',
  'USER_B_AUTH_UUID',
  true
);

do $$
begin
  if auth.uid() <> 'USER_B_AUTH_UUID'::uuid then
    raise exception 'User B JWT claim was not applied';
  end if;

  if not exists (
    select 1 from public.businesses
    where id = 'USER_B_BUSINESS_UUID'::uuid
      and owner_user_id = auth.uid()
  ) then
    raise exception 'User B cannot read their owned business';
  end if;

  if exists (
    select 1 from public.businesses
    where id in (
      'USER_A_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) then
    raise exception 'User B can read a foreign or unassigned business';
  end if;

  if exists (
    select 1 from public.products
    where business_id in (
      'USER_A_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) or exists (
    select 1 from public.orders
    where business_id in (
      'USER_A_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) or exists (
    select 1 from public.customers
    where business_id in (
      'USER_A_BUSINESS_UUID'::uuid,
      'UNASSIGNED_BUSINESS_UUID'::uuid
    )
  ) then
    raise exception 'User B can read another business product/order/customer';
  end if;
end
$$;

rollback;
