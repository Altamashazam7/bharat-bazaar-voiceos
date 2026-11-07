do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_owner_user_id_required'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_owner_user_id_required
      check (owner_user_id is not null)
      not valid;
  end if;
end
$$;
