-- Professional English Coach — initial schema.
--
-- Target: PostgreSQL 15+ (Supabase-compatible, and runnable on PGlite so the
-- schema is exercised in CI before it reaches a real database).
--
-- Two decisions shape everything below:
--
--  1. Taxonomies are tables, not enums. The manual (§16, §17, §36) requires
--     adding a career or a locale without touching application code, and
--     altering a Postgres enum is a migration every time.
--
--  2. Identity is `profiles`, not `users`. There is no auth provider yet (§40
--     keeps that decision open), so every row is attached to a device-issued
--     `anonymous_key`. Signing in later sets `profiles.user_id` on the existing
--     row and everything already collected follows — no cross-table backfill.
--
-- Retention: this stores what people actually write, which can include employer
-- names, project detail and recruiter names. A retention window and a delete
-- path must exist before real users are onboarded.

-- ---------------------------------------------------------------- taxonomies

create table input_languages (
  id     text primary key,
  label  text not null
);

-- §17: the locale is its own dimension, so en-CA / en-GB / en-AU need no
-- redesign — only rows.
create table locales (
  id                  text primary key,
  language            text not null,
  country             text not null,
  spelling_standard   text not null,
  professional_style  text not null
);

create table careers (
  id          text primary key,
  label       text not null,
  sort_order  integer not null
);

create table tones (
  id          text primary key,
  label       text not null,
  sort_order  integer not null
);

-- ------------------------------------------------------------------ identity

-- §15 `users`. Stays empty until an auth provider is chosen.
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  created_at  timestamptz not null default now()
);

create unique index users_email_key on users (lower(email));

-- §15 `user_profiles`, merged with the pre-auth identity.
create table profiles (
  id                  uuid primary key default gen_random_uuid(),
  anonymous_key       text not null unique,
  user_id             uuid null references users (id) on delete set null,
  interface_language  text not null default 'en' references input_languages (id),
  input_language      text not null default 'en' references input_languages (id),
  target_locale       text not null default 'en-US' references locales (id),
  country             text not null default 'US',
  career              text null references careers (id),
  english_level       text null,
  preferred_tone      text null references tones (id),
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now()
);

-- One profile per account once auth exists.
create unique index profiles_user_id_key on profiles (user_id) where user_id is not null;

-- ------------------------------------------------------------------- content

-- §15 `phrase_cards`. Pre-generated rather than produced per request (§25).
create table phrase_cards (
  id          text primary key,
  phrase      text not null,
  meaning     text not null,
  example     text not null,
  career      text not null references careers (id),
  category    text not null,
  difficulty  text not null,
  locale      text not null references locales (id),
  created_at  timestamptz not null default now()
);

-- §15 `translations`.
--
-- `result` holds the whole validated RewriteResponse so an entry can be
-- reopened without another model call (§25). The flattened columns exist so
-- analytics never has to dig through JSON.
create table translations (
  id                    text primary key,
  profile_id            uuid not null references profiles (id) on delete cascade,
  input_text            text not null,
  professional_version  text not null,
  career                text not null references careers (id),
  tone                  text not null references tones (id),
  locale                text not null references locales (id),
  result                jsonb not null,
  created_at            timestamptz not null default now()
);

create index translations_profile_created_idx
  on translations (profile_id, created_at desc);

-- §15 `saved_phrases`, widened.
--
-- §15 models this as a foreign key to `phrase_cards`, but a user can also save
-- a key phrase produced by a rewrite, which has no card behind it. `source`
-- carries the distinction and the check constraint keeps the two consistent.
create table saved_phrases (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles (id) on delete cascade,
  phrase_key      text not null,
  phrase          text not null,
  meaning         text not null,
  example         text null,
  career          text not null references careers (id),
  category        text null,
  difficulty      text null,
  source          text not null check (source in ('rewrite', 'phrase_card')),
  phrase_card_id  text null references phrase_cards (id) on delete set null,
  saved_at        timestamptz not null default now(),

  constraint saved_phrases_unique_per_profile unique (profile_id, phrase_key),

  constraint saved_phrases_source_matches_card check (
    (source = 'phrase_card' and phrase_card_id is not null)
    or (source = 'rewrite' and phrase_card_id is null)
  )
);

-- §15 `user_feedback`, §11 Workflow 4.
create table user_feedback (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles (id) on delete cascade,
  translation_id  text not null references translations (id) on delete cascade,
  feedback_type   text not null check (
                    feedback_type in ('useful', 'not_useful', 'too_formal', 'too_informal')
                  ),
  created_at      timestamptz not null default now(),

  constraint user_feedback_one_per_type unique (profile_id, translation_id, feedback_type)
);

-- §15 `learning_signals`, §11 Workflow 3.
create table learning_signals (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  skill       text not null,
  issue       text not null,
  expression  text not null,
  confidence  real not null check (confidence >= 0 and confidence <= 1),
  created_at  timestamptz not null default now()
);

-- Phase 5 validation (§30, §31).
--
-- The question the product has to answer is not how many rewrites ran, it is
-- whether the wording was good enough to send unedited.
create table translation_outcomes (
  id                uuid primary key default gen_random_uuid(),
  translation_id    text not null references translations (id) on delete cascade,
  profile_id        uuid not null references profiles (id) on delete cascade,
  action            text not null check (action in ('copied', 'edited', 'discarded')),
  accepted_version  text null,
  created_at        timestamptz not null default now()
);

create index translation_outcomes_translation_idx
  on translation_outcomes (translation_id);

-- ------------------------------------------------------------ access control

-- Row level security is enabled with no policies on purpose: nothing is
-- readable or writable by the anon and authenticated roles, so every access has
-- to go through the server boundary (§24). Real policies get written together
-- with the auth provider — until then, deny-all is the correct default.
--
-- Taxonomies are public reference data and are deliberately left open.
alter table profiles              enable row level security;
alter table translations          enable row level security;
alter table saved_phrases         enable row level security;
alter table user_feedback         enable row level security;
alter table learning_signals      enable row level security;
alter table translation_outcomes  enable row level security;
alter table users                 enable row level security;
