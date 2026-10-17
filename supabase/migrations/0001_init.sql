-- Keshkala: initial schema
-- All application access goes through server routes using the service role.
-- RLS is enabled on every table with NO policies, so the anon/authenticated
-- keys can read or write nothing directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- salons
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  name text not null,
  logo_url text,
  accent_color text not null default '#b08d57' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  booking_url text,
  whatsapp_number text,
  city text,
  plan text not null default 'pilot' check (plan in ('pilot', 'starter', 'pro', 'chain')),
  credits_total integer not null default 100 check (credits_total >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  period_start timestamptz not null default now(),
  active boolean not null default true,
  disabled_style_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  email text not null check (email = lower(email)),
  name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (salon_id, email)
);
create index members_email_idx on public.members (email);

-- ---------------------------------------------------------------- styles
create table public.styles (
  id text primary key,
  salon_id uuid references public.salons(id) on delete cascade, -- null = global
  name text not null,
  gender text not null check (gender in ('men', 'women')),
  length text not null check (length in ('short', 'medium', 'long')),
  textures text[] not null default '{straight,wavy,curly}',
  description text not null default '',
  prompt text not null,
  art jsonb not null default '{}'::jsonb,
  reference_image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index styles_salon_idx on public.styles (salon_id);

-- -------------------------------------------------------------- sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  mode text not null check (mode in ('studio', 'remote')),
  started_by uuid references public.members(id) on delete set null,
  token_hash text not null,
  photo_key text,
  photo_embedding real[],
  stylist_note text,
  chosen_result_ids uuid[] not null default '{}',
  share_token text unique,
  rounds integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  deleted_at timestamptz
);
create index sessions_salon_created_idx on public.sessions (salon_id, created_at desc);
create index sessions_expiry_idx on public.sessions (expires_at) where deleted_at is null;

-- DPDP consent ledger. Kept after the photo is deleted as proof of consent;
-- contains no personal image data.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  version text not null,
  text_hash text not null,
  is_minor boolean not null default false,
  guardian_consent boolean not null default false,
  ip_hash text,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check (not is_minor or guardian_consent)
);
create index consents_session_idx on public.consents (session_id);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  style_id text not null references public.styles(id),
  status text not null default 'pending' check (status in ('pending', 'running', 'ready', 'failed')),
  image_key text,
  provider text,
  similarity real,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index results_session_idx on public.results (session_id);
create index results_salon_created_idx on public.results (salon_id, created_at desc);

create table public.share_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'native', 'download', 'board', 'link')),
  created_at timestamptz not null default now()
);
create index share_events_salon_idx on public.share_events (salon_id, created_at desc);

-- Access log for personal data (kept 1 year). No foreign keys so rows
-- survive session deletion.
create table public.access_logs (
  id bigint generated always as identity primary key,
  salon_id uuid,
  session_id uuid,
  actor text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index access_logs_created_idx on public.access_logs (created_at);

alter table public.salons enable row level security;
alter table public.members enable row level security;
alter table public.styles enable row level security;
alter table public.sessions enable row level security;
alter table public.consents enable row level security;
alter table public.results enable row level security;
alter table public.share_events enable row level security;
alter table public.access_logs enable row level security;

-- ------------------------------------------------------------- functions
-- Atomically reserve try-on credits. Returns true when reserved.
create or replace function public.reserve_credits(p_salon uuid, p_count integer)
returns boolean language sql security definer set search_path = public as $$
  with upd as (
    update public.salons
       set credits_used = credits_used + p_count
     where id = p_salon and active and credits_used + p_count <= credits_total
    returning 1
  )
  select exists (select 1 from upd);
$$;

create or replace function public.refund_credits(p_salon uuid, p_count integer)
returns void language sql security definer set search_path = public as $$
  update public.salons set credits_used = greatest(0, credits_used - p_count) where id = p_salon;
$$;

revoke all on function public.reserve_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------- storage
-- Private bucket for photos and results (signed URLs only), public bucket
-- for salon logos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tryon', 'tryon', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- Belt and braces: database-side expiry in case the app cron stops. Storage
-- objects themselves are removed by /api/cron/cleanup (Storage API), which
-- also runs hourly. Requires the pg_cron extension (Database > Extensions).
-- select cron.schedule('keshkala-expire', '15 * * * *', $$
--   update public.sessions set photo_embedding = null, stylist_note = null
--    where expires_at < now() and deleted_at is null;
--   delete from public.access_logs where created_at < now() - interval '365 days';
-- $$);
