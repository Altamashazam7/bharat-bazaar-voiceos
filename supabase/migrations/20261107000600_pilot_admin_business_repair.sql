create or replace function public.pilot_admin_list_unassigned_businesses()
returns table (
  id uuid,
  name text,
  owner_name text,
  phone text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'pilot_admin', 'false') <> 'true' then
    raise exception 'Pilot administrator access is required'
      using errcode = '42501';
  end if;

  return query
    select b.id, b.name, b.owner_name, b.phone, b.created_at
    from public.businesses as b
    where b.owner_user_id is null
    order by b.created_at, b.id;
end
$$;

create or replace function public.pilot_admin_assign_business(
  p_business_id uuid,
  p_owner_user_id uuid
)
returns table (
  id uuid,
  owner_user_id uuid,
  name text,
  owner_name text,
  phone text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'pilot_admin', 'false') <> 'true' then
    raise exception 'Pilot administrator access is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users as u where u.id = p_owner_user_id
  ) then
    raise exception 'The selected owner does not exist'
      using errcode = '22023';
  end if;

  return query
    update public.businesses as b
    set owner_user_id = p_owner_user_id
    where b.id = p_business_id
      and b.owner_user_id is null
    returning b.id, b.owner_user_id, b.name, b.owner_name, b.phone, b.created_at;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Business was not found or already has an owner'
      using errcode = 'P0002';
  end if;
end
$$;

revoke all on function public.pilot_admin_list_unassigned_businesses()
  from public, anon;
revoke all on function public.pilot_admin_assign_business(uuid, uuid)
  from public, anon;
grant execute on function public.pilot_admin_list_unassigned_businesses()
  to authenticated;
grant execute on function public.pilot_admin_assign_business(uuid, uuid)
  to authenticated;
