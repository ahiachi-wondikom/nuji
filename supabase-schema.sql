
create extension if not exists pgcrypto;

-- Contributors (phone number is the login key)
create table if not exists users (
  phone text primary key,
  nickname text default '',
  state text default '',
  lga text default '',
  age text default '',
  gender text default '',
  languages jsonb default '[]'::jsonb,
  contribution_lang text default 'Igbo',
  ref_code text,
  referred_by text,
  referrals int default 0,
  points int default 0,
  subs jsonb default '{"text":0,"voice":0,"both":0,"mix":0}'::jsonb,
  lang_counts jsonb default '{}'::jsonb,
  reviews int default 0,
  days jsonb default '{}'::jsonb,
  streak int default 0,
  best_streak int default 0,
  last_day text,
  early_bird boolean default false,
  profile_kind text,
  created_at timestamptz default now()
);

-- Contributions (text and/or voice)
create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  phone text,
  language text,
  prompt text default '',
  text text default '',
  translation text default '',
  langs jsonb default '[]'::jsonb,
  formality text default 'Normal',
  audio_url text,
  duration float default 0,
  status text default 'pending',
  quality_flags jsonb default '[]'::jsonb,
  speaker jsonb default '{}'::jsonb,
  annotation text default '',
  annotation_status text default 'pending',
  points int default 0,
  reviews jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Daily prompts (the server auto-seeds 120 starter prompts on first boot)
create table if not exists prompts (
  id serial primary key,
  language text not null,
  text text not null,
  is_active boolean default true,
  uses int default 0,
  created_at timestamptz default now()
);

-- Storage bucket for voice recordings (publicly playable)
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do nothing;

create policy "public read recordings"
  on storage.objects for select
  using (bucket_id = 'recordings');


