create extension if not exists pgcrypto;

create type public.workspace_role as enum ('admin', 'manager', 'team_leader', 'employee');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'employee',
  team_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  foreign key (organization_id, team_id) references public.teams(organization_id, id) on delete set null (team_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 180),
  company text not null default '',
  email text not null default '',
  details text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_id uuid not null,
  client_id uuid,
  team_id uuid,
  title text not null check (length(trim(title)) between 1 and 300),
  description text not null default '',
  notes text not null default '',
  attachment_urls text[] not null default '{}',
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'on_hold')),
  starts_at date,
  due_at date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, list_id) references public.todo_lists(organization_id, id) on delete cascade,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete set null (client_id),
  foreign key (organization_id, team_id) references public.teams(organization_id, id) on delete set null (team_id),
  check (due_at is null or starts_at is null or due_at >= starts_at),
  unique (organization_id, id)
);

create table public.client_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  team_id uuid,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 300),
  description text not null default '',
  comments text not null default '',
  attachment_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'on_hold')),
  due_at date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade,
  foreign key (organization_id, team_id) references public.teams(organization_id, id) on delete set null (team_id),
  unique (organization_id, id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  title text not null check (length(trim(title)) between 1 and 300),
  event_type text not null default 'client_meeting' check (event_type in ('client_meeting', 'team_meeting', 'deadline', 'reminder', 'follow_up', 'business_event')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  meeting_url text not null default '',
  agenda text not null default '',
  assigned_employee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reminder_minutes integer not null default 30 check (reminder_minutes between 0 and 525600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete set null (client_id),
  check (ends_at > starts_at),
  unique (organization_id, id)
);

create table public.calendar_event_participants (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined')),
  primary key (event_id, user_id)
);

create table public.work_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('task_assigned', 'task_completed', 'deadline_approaching', 'task_overdue', 'requirement_updated', 'meeting_reminder', 'meeting_changed')),
  title text not null,
  message text not null default '',
  entity_type text,
  entity_id uuid,
  source_reminder_id uuid unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reminder_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.calendar_events(id) on delete cascade,
  task_id uuid references public.work_tasks(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('deadline_approaching', 'task_overdue', 'meeting_reminder')),
  scheduled_for timestamptz not null,
  claimed_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text not null default '',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  check ((event_id is null) <> (task_id is null))
);

create table public.work_activity_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index work_tasks_org_status_due_idx on public.work_tasks(organization_id, status, due_at);
create index work_tasks_org_assignee_due_idx on public.work_tasks(organization_id, assignee_id, due_at);
create index requirements_org_client_status_idx on public.client_requirements(organization_id, client_id, status);
create index events_org_starts_idx on public.calendar_events(organization_id, starts_at);
create index notifications_user_unread_idx on public.work_notifications(user_id, created_at desc) where read_at is null;
create index reminders_due_idx on public.reminder_queue(scheduled_for) where delivered_at is null;
create index work_activity_entity_idx on public.work_activity_log(organization_id, entity_type, entity_id, created_at desc);

create function public.current_workspace_role(target_organization uuid)
returns public.workspace_role
language sql stable security definer set search_path = public
as $$
  select role from public.organization_members
  where organization_id = target_organization and user_id = auth.uid() and active
  limit 1
$$;

create function public.create_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(id, email)
    values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
    on conflict (id) do nothing;
  insert into public.organizations(name, created_by)
    values (trim(workspace_name), auth.uid()) returning id into new_organization_id;
  insert into public.organization_members(organization_id, user_id, role)
    values (new_organization_id, auth.uid(), 'admin');
  return new_organization_id;
end
$$;

create function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

create function public.log_work_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.work_activity_log(organization_id, actor_id, entity_type, entity_id, action, details)
  values (
    (row_data ->> 'organization_id')::uuid, auth.uid(), tg_table_name,
    (row_data ->> 'id')::uuid,
    case when tg_op = 'INSERT' then 'created' when tg_op = 'DELETE' then 'deleted' else 'updated' end,
    row_data
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create function public.notify_task_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.assignee_id is not null and new.assignee_id <> auth.uid() then
    insert into public.work_notifications(organization_id, user_id, kind, title, message, entity_type, entity_id)
    values (new.organization_id, new.assignee_id, 'task_assigned', 'New task assigned', new.title, 'task', new.id);
  elsif tg_op = 'UPDATE' and old.status <> 'completed' and new.status = 'completed' then
    insert into public.work_notifications(organization_id, user_id, kind, title, message, entity_type, entity_id)
    select new.organization_id, member.user_id, 'task_completed', 'Task completed', new.title, 'task', new.id
    from public.organization_members member
    where member.organization_id = new.organization_id and member.active
      and member.role in ('admin', 'manager') and member.user_id <> auth.uid();
  end if;
  return new;
end
$$;

create function public.enqueue_task_reminder()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.reminder_queue where task_id = new.id and delivered_at is null;
  if new.assignee_id is not null and new.due_at is not null and new.status <> 'completed' then
    insert into public.reminder_queue(organization_id, user_id, task_id, reminder_kind, scheduled_for)
    values
      (new.organization_id, new.assignee_id, new.id, 'deadline_approaching', (new.due_at::timestamp at time zone 'UTC') + interval '9 hours' - interval '1 day'),
      (new.organization_id, new.assignee_id, new.id, 'task_overdue', (new.due_at::timestamp at time zone 'UTC') + interval '17 hours');
    insert into public.reminder_queue(organization_id, user_id, task_id, reminder_kind, scheduled_for)
    select new.organization_id, member.user_id, new.id, 'task_overdue', (new.due_at::timestamp at time zone 'UTC') + interval '17 hours'
    from public.organization_members member
    where member.organization_id = new.organization_id and member.active
      and member.role in ('admin', 'manager') and member.user_id <> new.assignee_id;
  end if;
  return new;
end
$$;

create function public.enqueue_event_reminder()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reminder_user uuid;
begin
  delete from public.reminder_queue where event_id = new.id and delivered_at is null;
  reminder_user := coalesce(new.assigned_employee_id, new.created_by);
  insert into public.reminder_queue(organization_id, user_id, event_id, reminder_kind, scheduled_for)
  values (new.organization_id, reminder_user, new.id, 'meeting_reminder', new.starts_at - make_interval(mins => new.reminder_minutes));
  return new;
end
$$;

create function public.notify_requirement_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.assignee_id is not null and new.assignee_id <> auth.uid() then
      insert into public.work_notifications(organization_id, user_id, kind, title, message, entity_type, entity_id)
      values (new.organization_id, new.assignee_id, 'requirement_updated', 'Client requirement updated', new.title, 'requirement', new.id);
    end if;
  end if;
  return new;
end
$$;

create function public.notify_event_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.work_notifications(organization_id, user_id, kind, title, message, entity_type, entity_id)
  select new.organization_id, recipients.user_id, 'meeting_changed',
    case when tg_op = 'INSERT' then 'Meeting scheduled' else 'Meeting updated' end,
    new.title, 'calendar_event', new.id
  from (
    select new.assigned_employee_id as user_id where new.assigned_employee_id is not null
    union
    select participant.user_id from public.calendar_event_participants participant where participant.event_id = new.id
  ) recipients
  where recipients.user_id <> auth.uid();
  return new;
end
$$;

create function public.validate_work_assignee()
returns trigger language plpgsql security definer set search_path = public
as $$
declare assigned_user uuid;
begin
  assigned_user := case when tg_table_name = 'calendar_events'
    then (to_jsonb(new) ->> 'assigned_employee_id')::uuid
    else (to_jsonb(new) ->> 'assignee_id')::uuid
  end;
  if assigned_user is not null and not exists (
    select 1 from public.organization_members member
    where member.organization_id = new.organization_id
      and member.user_id = assigned_user and member.active
  ) then
    raise exception 'Assignee must be an active member of the same organization';
  end if;
  return new;
end
$$;

create function public.validate_event_participant()
returns trigger language plpgsql security definer set search_path = public
as $$
declare event_organization uuid;
begin
  select organization_id into event_organization from public.calendar_events where id = new.event_id;
  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = event_organization
      and member.user_id = new.user_id and member.active
  ) then
    raise exception 'Participant must be an active member of the event organization';
  end if;
  return new;
end
$$;

create function public.notify_added_event_participant()
returns trigger language plpgsql security definer set search_path = public
as $$
declare event_record public.calendar_events%rowtype;
begin
  select * into event_record from public.calendar_events where id = new.event_id;
  if event_record.id is not null and new.user_id <> auth.uid() then
    insert into public.work_notifications(organization_id, user_id, kind, title, message, entity_type, entity_id)
    values (event_record.organization_id, new.user_id, 'meeting_changed', 'Meeting invitation', event_record.title, 'calendar_event', event_record.id);
  end if;
  return new;
end
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger todo_lists_updated_at before update on public.todo_lists for each row execute function public.set_updated_at();
create trigger work_tasks_updated_at before update on public.work_tasks for each row execute function public.set_updated_at();
create trigger requirements_updated_at before update on public.client_requirements for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
create trigger tasks_log after insert or update or delete on public.work_tasks for each row execute function public.log_work_change();
create trigger requirements_log after insert or update or delete on public.client_requirements for each row execute function public.log_work_change();
create trigger events_log after insert or update or delete on public.calendar_events for each row execute function public.log_work_change();
create trigger lists_log after insert or update or delete on public.todo_lists for each row execute function public.log_work_change();
create trigger tasks_notify after insert or update of status on public.work_tasks for each row execute function public.notify_task_changes();
create trigger tasks_reminder after insert or update of assignee_id, due_at, status on public.work_tasks for each row execute function public.enqueue_task_reminder();
create trigger events_reminder after insert or update of starts_at, reminder_minutes, assigned_employee_id on public.calendar_events for each row execute function public.enqueue_event_reminder();
create trigger requirements_notify after insert or update on public.client_requirements for each row execute function public.notify_requirement_changes();
create trigger events_notify after insert or update on public.calendar_events for each row execute function public.notify_event_changes();
create trigger event_participants_notify after insert on public.calendar_event_participants for each row execute function public.notify_added_event_participant();
create trigger tasks_validate_assignee before insert or update of organization_id, assignee_id on public.work_tasks for each row execute function public.validate_work_assignee();
create trigger requirements_validate_assignee before insert or update of organization_id, assignee_id on public.client_requirements for each row execute function public.validate_work_assignee();
create trigger events_validate_assignee before insert or update of organization_id, assigned_employee_id on public.calendar_events for each row execute function public.validate_work_assignee();
create trigger participants_validate_member before insert or update of event_id, user_id on public.calendar_event_participants for each row execute function public.validate_event_participant();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.teams enable row level security;
alter table public.clients enable row level security;
alter table public.todo_lists enable row level security;
alter table public.work_tasks enable row level security;
alter table public.client_requirements enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_participants enable row level security;
alter table public.work_notifications enable row level security;
alter table public.reminder_queue enable row level security;
alter table public.work_activity_log enable row level security;

create policy organizations_read_member on public.organizations for select using (public.current_workspace_role(id) is not null);
create policy profiles_read_workspace on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.organization_members member
    where member.user_id = profiles.id and public.current_workspace_role(member.organization_id) is not null
  )
);
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy members_read_workspace on public.organization_members for select using (public.current_workspace_role(organization_id) is not null);
create policy members_admin_manage on public.organization_members for all
  using (public.current_workspace_role(organization_id) = 'admin')
  with check (public.current_workspace_role(organization_id) = 'admin');

create policy teams_read_workspace on public.teams for select using (public.current_workspace_role(organization_id) is not null);
create policy teams_manager_write on public.teams for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));
create policy clients_read_workspace on public.clients for select using (public.current_workspace_role(organization_id) is not null);
create policy clients_manager_write on public.clients for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'));

create policy lists_read_workspace on public.todo_lists for select using (public.current_workspace_role(organization_id) is not null);
create policy lists_member_insert on public.todo_lists for insert with check (public.current_workspace_role(organization_id) is not null and created_by = auth.uid());
create policy lists_manager_update on public.todo_lists for update
  using (created_by = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'))
  with check (public.current_workspace_role(organization_id) is not null);
create policy lists_manager_delete on public.todo_lists for delete
  using (created_by = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'));

create policy tasks_read_workspace on public.work_tasks for select using (public.current_workspace_role(organization_id) is not null);
create policy tasks_member_insert on public.work_tasks for insert with check (public.current_workspace_role(organization_id) is not null and assigned_by = auth.uid());
create policy tasks_assignee_update on public.work_tasks for update
  using (assigned_by = auth.uid() or assignee_id = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'))
  with check (public.current_workspace_role(organization_id) is not null);
create policy tasks_manager_delete on public.work_tasks for delete
  using (assigned_by = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'));

create policy requirements_read_workspace on public.client_requirements for select using (public.current_workspace_role(organization_id) is not null);
create policy requirements_member_insert on public.client_requirements for insert with check (public.current_workspace_role(organization_id) is not null and created_by = auth.uid());
create policy requirements_assignee_update on public.client_requirements for update
  using (created_by = auth.uid() or assignee_id = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'))
  with check (public.current_workspace_role(organization_id) is not null);
create policy requirements_manager_delete on public.client_requirements for delete
  using (created_by = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'));

create policy events_read_workspace on public.calendar_events for select using (public.current_workspace_role(organization_id) is not null);
create policy events_member_insert on public.calendar_events for insert with check (public.current_workspace_role(organization_id) is not null and created_by = auth.uid());
create policy events_member_update on public.calendar_events for update
  using (created_by = auth.uid() or assigned_employee_id = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'))
  with check (public.current_workspace_role(organization_id) is not null);
create policy events_manager_delete on public.calendar_events for delete
  using (created_by = auth.uid() or public.current_workspace_role(organization_id) in ('admin', 'manager', 'team_leader'));

create policy event_participants_read_workspace on public.calendar_event_participants for select using (
  exists (select 1 from public.calendar_events event where event.id = event_id and public.current_workspace_role(event.organization_id) is not null)
);
create policy event_participants_insert_self_or_manager on public.calendar_event_participants for insert with check (
  user_id = auth.uid() or exists (
    select 1 from public.calendar_events event
    where event.id = event_id and (
      event.created_by = auth.uid()
      or public.current_workspace_role(event.organization_id) in ('admin', 'manager', 'team_leader')
    )
  )
);
create policy event_participants_update_self_or_manager on public.calendar_event_participants for update
  using (user_id = auth.uid() or exists (
    select 1 from public.calendar_events event
    where event.id = event_id and (
      event.created_by = auth.uid()
      or public.current_workspace_role(event.organization_id) in ('admin', 'manager', 'team_leader')
    )
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from public.calendar_events event
    where event.id = event_id and (
      event.created_by = auth.uid()
      or public.current_workspace_role(event.organization_id) in ('admin', 'manager', 'team_leader')
    )
  ));
create policy event_participants_delete_self_or_manager on public.calendar_event_participants for delete using (
  user_id = auth.uid() or exists (
    select 1 from public.calendar_events event
    where event.id = event_id and (
      event.created_by = auth.uid()
      or public.current_workspace_role(event.organization_id) in ('admin', 'manager', 'team_leader')
    )
  )
);
create policy notifications_read_own on public.work_notifications for select using (
  user_id = auth.uid() and public.current_workspace_role(organization_id) is not null
);
create policy notifications_update_own on public.work_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminders_read_own on public.reminder_queue for select using (user_id = auth.uid() and public.current_workspace_role(organization_id) is not null);
create policy activity_read_workspace on public.work_activity_log for select using (public.current_workspace_role(organization_id) is not null);

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.current_workspace_role(uuid) to authenticated;