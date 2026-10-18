/**
 * Schema migrations, applied in order at startup (lib/db/pool.ts).
 * Never edit a released migration; append a new one.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
create extension if not exists pgcrypto;

create table salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  name text not null,
  logo_url text,
  accent_color text not null default '#c49a5a' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  booking_url text,
  whatsapp_number text,
  city text,
  credits_total integer not null default 0 check (credits_total >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  active boolean not null default true,
  disabled_style_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  password_hash text not null,
  name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);
create index members_salon_idx on members (salon_id);

create table styles (
  id text primary key,
  salon_id uuid references salons(id) on delete cascade,
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
create index styles_salon_idx on styles (salon_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  mode text not null check (mode in ('studio', 'remote')),
  started_by uuid references members(id) on delete set null,
  token_hash text not null,
  photo_key text,
  photo_embedding real[],
  provider_state jsonb,
  stylist_note text,
  chosen_result_ids uuid[] not null default '{}',
  share_token text unique,
  rounds integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz
);
create index sessions_salon_created_idx on sessions (salon_id, created_at desc);
create index sessions_expiry_idx on sessions (expires_at) where deleted_at is null;
create index sessions_remote_cleanup_idx on sessions (deleted_at) where provider_state is not null;

-- DPDP consent ledger; kept after photos are deleted, contains no images.
create table consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  version text not null,
  text_hash text not null,
  is_minor boolean not null default false,
  guardian_consent boolean not null default false,
  ip_hash text,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check (not is_minor or guardian_consent)
);
create index consents_session_idx on consents (session_id);

create table results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  style_id text not null references styles(id),
  status text not null default 'pending' check (status in ('pending', 'running', 'ready', 'failed')),
  image_key text,
  provider text,
  similarity real,
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index results_session_idx on results (session_id);
create index results_salon_created_idx on results (salon_id, created_at desc);

create table share_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  salon_id uuid not null references salons(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'native', 'download', 'board', 'link')),
  created_at timestamptz not null default now()
);
create index share_events_salon_idx on share_events (salon_id, created_at desc);

-- Access log for personal data, kept one year. No foreign keys so rows outlive sessions.
create table access_logs (
  id bigint generated always as identity primary key,
  salon_id uuid,
  session_id uuid,
  actor text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index access_logs_created_idx on access_logs (created_at);
`,
  },
];
