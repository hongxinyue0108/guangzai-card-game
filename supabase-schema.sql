create table if not exists players (
  id text primary key,
  nickname text not null unique,
  password_hash text not null,
  score integer not null default 0,
  fragments integer not null default 0,
  draw_chances integer not null default 3,
  last_recovered_at timestamptz not null default now(),
  opened_packs integer not null default 0,
  owned_cards jsonb not null default '{}'::jsonb,
  share_rewards jsonb not null default '{}'::jsonb,
  task_rewards jsonb not null default '{}'::jsonb,
  series_rewards jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table players
  add column if not exists last_recovered_at timestamptz not null default now();

create table if not exists sessions (
  token text primary key,
  player_id text not null references players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists shares (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  nickname text not null,
  scene text not null,
  visits integer not null default 0,
  rewarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists draw_records (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  nickname text not null,
  card_id text not null,
  card_name text not null,
  series text not null,
  rarity text not null,
  rarity_name text not null,
  duplicated boolean not null default false,
  score_gained integer not null default 0,
  fragments_gained integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  type text not null,
  player_id text references players(id) on delete set null,
  share_id text,
  card_id text,
  scene text,
  duplicated boolean,
  rewarded boolean,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_players_score on players(score desc);
create index if not exists idx_draw_records_player_id on draw_records(player_id);
create index if not exists idx_draw_records_created_at on draw_records(created_at desc);
create index if not exists idx_events_type on events(type);
create index if not exists idx_events_created_at on events(created_at desc);
create index if not exists idx_shares_player_id on shares(player_id);
