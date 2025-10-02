-- Registration profile automation and helper routines
set search_path = public;

create or replace function public.ensure_profile_for_role(p_user_id uuid, p_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if p_role = 'client' then
    insert into public.client_profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
    delete from public.developer_profiles where user_id = p_user_id;
  elsif p_role = 'developer' then
    insert into public.developer_profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
    delete from public.client_profiles where user_id = p_user_id;
  else
    -- Admins and other roles do not maintain role-specific profiles by default
    delete from public.client_profiles where user_id = p_user_id;
    delete from public.developer_profiles where user_id = p_user_id;
  end if;
end;
$$;

grant execute on function public.ensure_profile_for_role(uuid, user_role) to authenticated;

create or replace function public.create_user_with_profile(p_auth_user uuid, p_email text, p_role user_role)
returns public.users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_record public.users;
  resolved_email citext;
begin
  if p_auth_user is null then
    raise exception 'auth_user_id is required';
  end if;

  if p_email is not null then
    resolved_email := p_email::citext;
  else
    select u.email::citext into resolved_email from auth.users u where u.id = p_auth_user;
  end if;

  if resolved_email is null then
    raise exception 'Unable to resolve email for auth user %', p_auth_user;
  end if;

  insert into public.users (auth_user_id, email, role)
  values (p_auth_user, resolved_email, p_role)
  on conflict (auth_user_id) do update
    set email = excluded.email,
        role = excluded.role
  returning * into target_record;

  perform public.ensure_profile_for_role(target_record.id, target_record.role);

  return target_record;
end;
$$;

grant execute on function public.create_user_with_profile(uuid, text, user_role) to authenticated;

drop trigger if exists sync_profile_after_users on public.users;

create or replace function public.sync_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_profile_for_role(new.id, new.role);
  return new;
end;
$$;

create trigger sync_profile_after_users
after insert or update on public.users
for each row execute function public.sync_profile_for_user();
create or replace function auth.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  raw_role text;
  normalized_role user_role;
begin
  raw_role := coalesce(new.raw_user_meta_data->>'role', new.raw_app_meta_data->>'role', 'developer');

  begin
    normalized_role := raw_role::user_role;
  exception when others then
    normalized_role := 'developer';
  end;

  perform public.create_user_with_profile(new.id, new.email, normalized_role);
  return new;
end;
$$;

drop trigger if exists handle_new_user_profile on auth.users;

create trigger handle_new_user_profile
after insert on auth.users
for each row execute function auth.handle_new_user_profile();
