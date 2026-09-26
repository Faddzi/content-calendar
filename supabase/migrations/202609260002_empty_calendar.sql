delete from public.calendar_posts post
using public.workspaces workspace, public.companies company,
  (values
    ('Draftss.com', 'X', '3 design mistakes that cost you', date '2026-09-22'),
    ('Draftss.com', 'Instagram', '5 quick brand refresh tips', date '2026-09-23'),
    ('Draftss.com', 'LinkedIn', '10x output case study', date '2026-09-24'),
    ('Draftss.com', 'Threads', 'Biggest design challenge?', date '2026-09-25'),
    ('Deliveryman.ai', 'X', 'Cold email without GSuite?', date '2026-09-22'),
    ('Deliveryman.ai', 'LinkedIn', 'Email inbox delivery stats', date '2026-09-24'),
    ('Draftss.com', 'X', 'Design vs Development: which costs more?', date '2026-09-29'),
    ('Draftss.com', 'Instagram', 'Comic Sans joke', date '2026-10-01'),
    ('Draftss.com', 'LinkedIn', 'Cost-saving client story', date '2026-10-02'),
    ('Draftss.com', 'Threads', 'Top 3 free design tools', date '2026-10-03'),
    ('Deliveryman.ai', 'X', 'Spam folder myth', date '2026-09-29'),
    ('Deliveryman.ai', 'LinkedIn', '5 email warm-up mistakes', date '2026-10-01'),
    ('Draftss.com', 'X', 'Explainer vs testimonial video', date '2026-10-06'),
    ('Draftss.com', 'Instagram', 'Sketch to final design reveal', date '2026-10-07'),
    ('Draftss.com', 'LinkedIn', 'Video content trust stat', date '2026-10-08'),
    ('Draftss.com', 'Threads', 'Biggest design struggle?', date '2026-10-09'),
    ('Deliveryman.ai', 'X', '0 spam after 100k emails', date '2026-10-06'),
    ('Deliveryman.ai', 'LinkedIn', 'Burned domains? We have a solution', date '2026-10-08'),
    ('Deliveryman.ai', 'Threads', 'Cold email pain points?', date '2026-10-09')
  ) as sample(company_name, platform, topic, scheduled_for)
where post.workspace_id = workspace.id
  and post.created_by = workspace.created_by
  and company.workspace_id = workspace.id
  and company.id = post.company_id
  and company.name = sample.company_name
  and post.platform = sample.platform
  and post.topic = sample.topic
  and post.scheduled_for = sample.scheduled_for;

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
