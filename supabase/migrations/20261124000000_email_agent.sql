-- AI Email Marketing Agent: templates, follow-up sequences, and recipient consent management.
-- Apply after 20261122000000_work_management.sql and 20261123000000_email_marketing.sql.

-- Reusable responsive HTML email templates with brand settings.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null default 'Professional',
  style text not null default 'corporate' check (style in ('corporate', 'minimal', 'modern', 'premium', 'promotional', 'creative')),
  subject text not null default '',
  headline text not null default '',
  body text not null default '',
  cta_text text not null default '',
  cta_url text not null default '',
  signature text not null default '',
  brand_colors text not null default '#17253a, #ed6a5a',
  logo_url text not null default '',
  social_links jsonb not null default '{}'::jsonb,
  footer_text text not null default '',
  html_body text not null default '',
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

-- Multi-step automated follow-up sequences (Day 1 / Day 3 / Day 7 style).
create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  trigger_category text not null default 'Follow-up',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  audience_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid not null,
  step_order integer not null check (step_order between 1 and 20),
  delay_days integer not null default 0 check (delay_days between 0 and 365),
  subject text not null default '',
  body text not null default '',
  cta_text text not null default '',
  cta_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, sequence_id) references public.email_sequences(organization_id, id) on delete cascade,
  unique (sequence_id, step_order),
  unique (organization_id, id)
);

create index email_templates_org_idx on public.email_templates(organization_id, updated_at desc);
create index email_sequences_org_idx on public.email_sequences(organization_id, updated_at desc);
create index email_sequence_steps_order_idx on public.email_sequence_steps(organization_id, sequence_id, step_order);

create trigger email_templates_updated_at before update on public.email_templates for each row execute function public.set_updated_at();
create trigger email_sequences_updated_at before update on public.email_sequences for each row execute function public.set_updated_at();
create trigger email_sequence_steps_updated_at before update on public.email_sequence_steps for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;
alter table public.email_sequences enable row level security;
alter table public.email_sequence_steps enable row level security;

create policy email_templates_read_workspace on public.email_templates for select using (public.current_workspace_role(organization_id) is not null);
create policy email_templates_manager_manage on public.email_templates for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));

create policy email_sequences_read_workspace on public.email_sequences for select using (public.current_workspace_role(organization_id) is not null);
create policy email_sequences_manager_manage on public.email_sequences for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));

create policy email_sequence_steps_read_workspace on public.email_sequence_steps for select using (public.current_workspace_role(organization_id) is not null);
create policy email_sequence_steps_manager_manage on public.email_sequence_steps for all
  using (public.current_workspace_role(organization_id) in ('admin', 'manager'))
  with check (public.current_workspace_role(organization_id) in ('admin', 'manager'));