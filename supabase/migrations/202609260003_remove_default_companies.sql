-- Migration 003: remove hardcoded default companies from workspace creation
--
-- Previously, creating a workspace automatically inserted "Draftss.com" and
-- "Deliveryman.ai" as default companies. Workspaces now start empty so every
-- team can add their own companies.

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

  insert into public.workspaces (name, created_by)
    values (trim(p_name), v_user_id)
    returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_user_id, 'admin');

  -- No default companies: each workspace admin adds their own clients/brands.
  return v_workspace_id;
end;
$$;
