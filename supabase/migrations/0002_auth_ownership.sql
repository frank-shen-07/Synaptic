alter table public.sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.ideas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.idea_edges
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

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
