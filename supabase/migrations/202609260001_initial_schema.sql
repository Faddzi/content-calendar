create type public.member_role as enum ('admin', 'contributor', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();
alter table public.workspace_members
  add constraint workspace_members_profile_fk foreign key (user_id) references public.profiles(id) on delete cascade;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 50),
  color text not null default '#d77858' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index companies_workspace_name_unique on public.companies (workspace_id, lower(name));

create table public.calendar_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null,
  platform text not null check (length(trim(platform)) between 1 and 40),
  topic text not null check (length(trim(topic)) between 1 and 200),
  scheduled_for date not null,
  published_url text check (published_url is null or published_url ~ '^https?://'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_posts_company_workspace_fk foreign key (workspace_id, company_id)
    references public.companies(workspace_id, id) on delete cascade
);
create index calendar_posts_workspace_date_idx on public.calendar_posts (workspace_id, scheduled_for);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and length(email) <= 254),
  role public.member_role not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);
create unique index workspace_invitations_pending_email_unique
  on public.workspace_invitations (workspace_id, email) where accepted_at is null;

create or replace function public.current_workspace_role(p_workspace_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role from public.workspace_members wm
  where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.calendar_posts enable row level security;
alter table public.workspace_invitations enable row level security;

create policy "members can read their workspaces" on public.workspaces
  for select to authenticated using (public.current_workspace_role(id) is not null);
create policy "admins can update their workspaces" on public.workspaces
  for update to authenticated using (public.current_workspace_role(id) = 'admin')
  with check (public.current_workspace_role(id) = 'admin');

create policy "members can read workspace members" on public.workspace_members
  for select to authenticated using (public.current_workspace_role(workspace_id) is not null);
create policy "teammates can read shared workspace profiles" on public.profiles
  for select to authenticated using (exists (
    select 1 from public.workspace_members wm
    where wm.user_id = profiles.id and public.current_workspace_role(wm.workspace_id) is not null
  ));
create policy "users can update their display name" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "members can read workspace companies" on public.companies
  for select to authenticated using (public.current_workspace_role(workspace_id) is not null);
create policy "admins can add workspace companies" on public.companies
  for insert to authenticated with check (public.current_workspace_role(workspace_id) = 'admin');
create policy "admins can update workspace companies" on public.companies
  for update to authenticated using (public.current_workspace_role(workspace_id) = 'admin')
  with check (public.current_workspace_role(workspace_id) = 'admin');
create policy "admins can remove workspace companies" on public.companies
  for delete to authenticated using (public.current_workspace_role(workspace_id) = 'admin');

create policy "members can read workspace posts" on public.calendar_posts
  for select to authenticated using (public.current_workspace_role(workspace_id) is not null);
create policy "contributors can create workspace posts" on public.calendar_posts
  for insert to authenticated with check (
    created_by = auth.uid() and public.current_workspace_role(workspace_id) in ('admin', 'contributor')
  );
create policy "admins can update workspace posts" on public.calendar_posts
  for update to authenticated using (public.current_workspace_role(workspace_id) = 'admin')
  with check (public.current_workspace_role(workspace_id) = 'admin');
create policy "admins can delete workspace posts" on public.calendar_posts
  for delete to authenticated using (public.current_workspace_role(workspace_id) = 'admin');

create policy "admins can read workspace invitations" on public.workspace_invitations
  for select to authenticated using (public.current_workspace_role(workspace_id) = 'admin');

create or replace function public.create_workspace_for_current_user(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Workspace name must be 2-80 characters'; end if;
  if exists (select 1 from public.workspace_members where user_id = v_user_id) then
    raise exception 'This account already belongs to a workspace';
  end if;

  insert into public.workspaces (name, created_by) values (trim(p_name), v_user_id) returning id into v_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_workspace_id, v_user_id, 'admin');
  insert into public.companies (workspace_id, name, color) values
    (v_workspace_id, 'Draftss.com', '#d77858'),
    (v_workspace_id, 'Deliveryman.ai', '#287ba0');
  return v_workspace_id;
end;
$$;

create or replace function public.create_workspace_invitation(
  p_workspace_id uuid, p_email text, p_role public.member_role, p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_user_id is null or public.current_workspace_role(p_workspace_id) <> 'admin' then raise exception 'Admin access required'; end if;
    if v_email !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'Enter a valid email address'; end if;
  if p_role is null or p_role not in ('admin', 'contributor', 'viewer') then raise exception 'Invalid member role'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation token'; end if;
  if (select count(*) from public.workspace_invitations where invited_by = v_user_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Invitation limit reached. Try again later.';
  end if;

  insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at, accepted_at)
  values (p_workspace_id, v_email, p_role, p_token_hash, v_user_id, now() + interval '7 days', null)
  on conflict (workspace_id, email) where accepted_at is null
  do update set role = excluded.role, token_hash = excluded.token_hash, invited_by = excluded.invited_by,
    created_at = now(), expires_at = excluded.expires_at
  returning id into v_invitation_id;
  return v_invitation_id;
end;
$$;

create or replace function public.accept_workspace_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_email_confirmed_at timestamptz;
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_user_id is null then raise exception 'Sign in to accept this invitation'; end if;
  select lower(u.email), u.email_confirmed_at into v_user_email, v_email_confirmed_at
    from auth.users u where u.id = v_user_id;
  if v_email_confirmed_at is null then raise exception 'Verify your email before accepting this invitation'; end if;
  select * into v_invitation from public.workspace_invitations
    where token_hash = p_token_hash and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if v_invitation.email <> v_user_email then raise exception 'Sign in with the email address this invitation was sent to'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (v_invitation.workspace_id, v_user_id, v_invitation.role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  update public.workspace_invitations set accepted_at = now() where id = v_invitation.id;
  return v_invitation.workspace_id;
end;
$$;

create or replace function public.update_workspace_member_role(
  p_workspace_id uuid, p_user_id uuid, p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_role public.member_role;
begin
  if auth.uid() is null or public.current_workspace_role(p_workspace_id) <> 'admin' then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'Use another admin profile to change your own role'; end if;
  if p_role is null then raise exception 'Invalid role'; end if;
  perform 1 from public.workspaces where id = p_workspace_id for update;
  select role into v_old_role from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id for update;
  if not found then raise exception 'Team member not found'; end if;
  if v_old_role = 'admin' and p_role <> 'admin' and
    (select count(*) from public.workspace_members where workspace_id = p_workspace_id and role = 'admin') <= 1 then
    raise exception 'A workspace must have at least one admin';
  end if;
  update public.workspace_members set role = p_role where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null or public.current_workspace_role(p_workspace_id) <> 'admin' then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove your own active account'; end if;
  perform 1 from public.workspaces where id = p_workspace_id for update;
  select role into v_role from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id for update;
  if not found then raise exception 'Team member not found'; end if;
  if v_role = 'admin' and (select count(*) from public.workspace_members where workspace_id = p_workspace_id and role = 'admin') <= 1 then
    raise exception 'A workspace must have at least one admin';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

create or replace function public.revoke_workspace_invitation(p_workspace_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_workspace_role(p_workspace_id) <> 'admin' then raise exception 'Admin access required'; end if;
  delete from public.workspace_invitations
    where id = p_invitation_id and workspace_id = p_workspace_id and accepted_at is null;
  if not found then raise exception 'Pending invitation not found'; end if;
end;
$$;

revoke all on function public.current_workspace_role(uuid) from public;
revoke all on function public.create_workspace_for_current_user(text) from public;
revoke all on function public.create_workspace_invitation(uuid, text, public.member_role, text) from public;
revoke all on function public.accept_workspace_invitation(text) from public;
revoke all on function public.update_workspace_member_role(uuid, uuid, public.member_role) from public;
revoke all on function public.remove_workspace_member(uuid, uuid) from public;
revoke all on function public.revoke_workspace_invitation(uuid, uuid) from public;
grant execute on function public.current_workspace_role(uuid) to authenticated;
grant execute on function public.create_workspace_for_current_user(text) to authenticated;
grant execute on function public.create_workspace_invitation(uuid, text, public.member_role, text) to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.update_workspace_member_role(uuid, uuid, public.member_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_workspace_invitation(uuid, uuid) to authenticated;
