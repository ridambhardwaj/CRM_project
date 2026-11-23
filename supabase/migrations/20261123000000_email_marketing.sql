create table public.email_marketing_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  email text not null,
  status text not null check (status in ('consented', 'legitimate_interest', 'withdrawn')),
  legal_basis text not null,
  source text not null,
  evidence text not null default '',
  captured_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete set null (client_id),
  unique (organization_id, email),
  check (email = lower(trim(email))),
  check ((status = 'withdrawn') = (revoked_at is not null))
);

create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('unsubscribe', 'complaint', 'hard_bounce', 'manual')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (organization_id, email),
  check (email = lower(trim(email)))
);

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  name text not null,
  category text not null,
  operating_mode text not null default 'approval' check (operating_mode in ('manual', 'approval', 'authorized_auto')),
  status text not null default 'draft' check (status in ('draft', 'needs_approval', 'approved', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  subject text not null,
  headline text not null default '',
  text_body text not null,
  html_body text not null,
  cta_text text not null default '',
  cta_url text not null default '',
  signature text not null default '',
  audience_rules jsonb not null default '{}'::jsonb,
  consent_required boolean not null default true check (consent_required),
  approved_at timestamptz,
  scheduled_at timestamptz,
  dispatch_token uuid,
  dispatch_started_at timestamptz,
  sent_at timestamptz,
  provider text not null default 'resend',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, created_by) references public.organization_members(organization_id, user_id),
  foreign key (organization_id, approved_by) references public.organization_members(organization_id, user_id),
  unique (organization_id, id),
  check (status not in ('approved', 'scheduled', 'sending', 'sent') or approved_at is not null),
  check (status <> 'scheduled' or scheduled_at is not null)
);

create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  client_id uuid,
  email text not null,
  recipient_name text not null default '',
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed')),
  provider_message_id text,
  error_message text not null default '',
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, campaign_id) references public.email_campaigns(organization_id, id) on delete cascade,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete set null (client_id),
  unique (campaign_id, email),
  unique (campaign_id, id),
  check (email = lower(trim(email)))
);

create table public.email_campaign_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  recipient_id uuid,
  provider text not null,
  provider_event_id text not null,
  event_type text not null check (event_type in ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'unsubscribed')),
  is_verified boolean not null default false,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, campaign_id) references public.email_campaigns(organization_id, id) on delete cascade,
  foreign key (campaign_id, recipient_id) references public.email_campaign_recipients(campaign_id, id) on delete set null (recipient_id),
  unique (provider, provider_event_id)
);

create index email_consent_eligible_idx on public.email_marketing_consents(organization_id, status, email);
create index email_suppression_org_email_idx on public.email_suppressions(organization_id, email);
create index email_campaign_schedule_idx on public.email_campaigns(scheduled_at) where status = 'scheduled';
create index email_recipients_queue_idx on public.email_campaign_recipients(organization_id, campaign_id, status);
create index email_events_verified_idx on public.email_campaign_events(organization_id, campaign_id, event_type) where is_verified;

create trigger email_consents_updated_at before update on public.email_marketing_consents for each row execute function public.set_updated_at();
create trigger email_campaigns_updated_at before update on public.email_campaigns for each row execute function public.set_updated_at();

alter table public.email_marketing_consents enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.email_campaign_events enable row level security;

create policy email_consents_read_workspace on public.email_marketing_consents for select using (public.current_workspace_role(organization_id) is not null);
create policy email_consents_manage on public.email_marketing_consents for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));
create policy email_suppressions_read_workspace on public.email_suppressions for select using (public.current_workspace_role(organization_id) is not null);
create policy email_suppressions_manage on public.email_suppressions for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));
create policy email_campaigns_read_workspace on public.email_campaigns for select using (public.current_workspace_role(organization_id) is not null);
create policy email_campaigns_manager_manage on public.email_campaigns for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));
create policy email_campaign_recipients_read_workspace on public.email_campaign_recipients for select using (public.current_workspace_role(organization_id) is not null);
create policy email_campaign_events_read_workspace on public.email_campaign_events for select using (public.current_workspace_role(organization_id) is not null);