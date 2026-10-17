-- Remote copies held by image providers (Magnific folder + uploaded photo).
-- Cleared once the provider confirms deletion; the cleanup cron retries
-- erased sessions that still have state.
alter table public.sessions add column if not exists provider_state jsonb;
create index if not exists sessions_remote_cleanup_idx on public.sessions (deleted_at) where provider_state is not null;
