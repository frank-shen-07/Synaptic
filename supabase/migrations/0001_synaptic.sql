create table if not exists public.sessions (
  id text primary key,
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
  prior_art jsonb not null default '[]'::jsonb,
  crosscheck_query text,
  crosschecked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.idea_edges (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  source_id text not null,
  target_id text not null,
  label text not null,
  explanation text not null,
  strength double precision not null,
  highlighted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ideas_session_id_idx on public.ideas(session_id);
create index if not exists ideas_parent_id_idx on public.ideas(parent_id);
create index if not exists idea_edges_session_id_idx on public.idea_edges(session_id);
create index if not exists sessions_updated_at_idx on public.sessions(updated_at desc);
