create database if not exists guangzai_card_game
  default character set utf8mb4
  collate utf8mb4_unicode_ci;

use guangzai_card_game;

create table if not exists players (
  id varchar(64) primary key,
  nickname varchar(64) not null unique,
  password_hash varchar(128) not null,
  score int not null default 0,
  fragments int not null default 0,
  draw_chances int not null default 3,
  last_recovered_at datetime(3) not null default current_timestamp(3),
  last_login_at datetime(3) null,
  opened_packs int not null default 0,
  owned_cards json not null,
  share_rewards json not null,
  task_rewards json not null,
  series_rewards json not null,
  milestone_rewards json not null,
  challenge_state json not null,
  effect_state json not null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index idx_players_score (score desc),
  index idx_players_nickname (nickname)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists shares (
  id varchar(64) primary key,
  player_id varchar(64) not null,
  nickname varchar(64) not null,
  scene varchar(64) not null,
  visits int not null default 0,
  rewarded tinyint(1) not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  index idx_shares_player_id (player_id),
  constraint fk_shares_player foreign key (player_id) references players(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists sessions (
  token varchar(96) primary key,
  player_id varchar(64) not null,
  created_at datetime(3) not null default current_timestamp(3),
  expires_at datetime(3) not null,
  index idx_sessions_player_id (player_id),
  index idx_sessions_expires_at (expires_at),
  constraint fk_sessions_player foreign key (player_id) references players(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists draw_records (
  id varchar(64) primary key,
  player_id varchar(64) not null,
  nickname varchar(64) not null,
  card_id varchar(32) not null,
  card_name varchar(64) not null,
  series varchar(64) not null,
  rarity varchar(32) not null,
  rarity_name varchar(32) not null,
  duplicated tinyint(1) not null default 0,
  score_gained int not null default 0,
  fragments_gained int not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  index idx_draw_records_player_id (player_id),
  index idx_draw_records_created_at (created_at desc),
  constraint fk_draw_records_player foreign key (player_id) references players(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists events (
  id varchar(64) primary key,
  type varchar(64) not null,
  player_id varchar(64),
  share_id varchar(64),
  card_id varchar(32),
  scene varchar(64),
  duplicated tinyint(1),
  rewarded tinyint(1),
  payload json not null,
  created_at datetime(3) not null default current_timestamp(3),
  index idx_events_player_id (player_id),
  index idx_events_type (type),
  index idx_events_created_at (created_at desc),
  index idx_events_share_id (share_id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
