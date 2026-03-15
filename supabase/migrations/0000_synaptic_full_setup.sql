create table if not exists public.sessions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  seed text not null,
  domain text,
  graph jsonb not null,
  insights jsonb not null,
  one_pager jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ideas (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  parent_id text,
  label text not null,
  node_type text not null,
  depth integer not null,
  detail_level integer not null,
  summary text not null,
  confidence double precision not null,
  weight double precision not null,
  expandable boolean not null,
  status text not null,
  severity text,
  source_urls jsonb not null default '[]'::jsonb,
  details jsonb not null,
  content_status text not null default 'ready',
  content_error text,
  hydrated_at timestamptz,
  prior_art jsonb not null default '[]'::jsonb,
  crosscheck_query text,
  crosschecked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.idea_edges (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  source_id text not null,
  target_id text not null,
  label text not null,
  explanation text not null,
  strength double precision not null,
  highlighted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.ideas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.idea_edges
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.ideas
  add column if not exists content_status text not null default 'ready';

alter table public.ideas
  add column if not exists content_error text;

alter table public.ideas
  add column if not exists hydrated_at timestamptz;

create index if not exists ideas_session_id_idx on public.ideas(session_id);
create index if not exists ideas_parent_id_idx on public.ideas(parent_id);
create index if not exists idea_edges_session_id_idx on public.idea_edges(session_id);
create index if not exists sessions_updated_at_idx on public.sessions(updated_at desc);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists ideas_user_id_idx on public.ideas(user_id);
create index if not exists idea_edges_user_id_idx on public.idea_edges(user_id);

alter table public.sessions enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_edges enable row level security;

drop policy if exists "Users can read own sessions" on public.sessions;
drop policy if exists "Users can insert own sessions" on public.sessions;
drop policy if exists "Users can update own sessions" on public.sessions;
drop policy if exists "Users can delete own sessions" on public.sessions;

create policy "Users can read own sessions"
  on public.sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own ideas" on public.ideas;
drop policy if exists "Users can insert own ideas" on public.ideas;
drop policy if exists "Users can update own ideas" on public.ideas;
drop policy if exists "Users can delete own ideas" on public.ideas;

create policy "Users can read own ideas"
  on public.ideas
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own ideas"
  on public.ideas
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ideas"
  on public.ideas
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own ideas"
  on public.ideas
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own edges" on public.idea_edges;
drop policy if exists "Users can insert own edges" on public.idea_edges;
drop policy if exists "Users can update own edges" on public.idea_edges;
drop policy if exists "Users can delete own edges" on public.idea_edges;

create policy "Users can read own edges"
  on public.idea_edges
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own edges"
  on public.idea_edges
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own edges"
  on public.idea_edges
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own edges"
  on public.idea_edges
  for delete
  using (auth.uid() = user_id);
