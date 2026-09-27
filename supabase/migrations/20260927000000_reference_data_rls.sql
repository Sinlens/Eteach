-- Reference data: readable by anyone, writable by no one.
--
-- `20260926120000_initial_schema.sql` enabled row level security on every table
-- holding user data and left the taxonomies alone, on the grounds that they are
-- public reference data. They were left open for *writing* too, which was never
-- the intent.
--
-- Supabase grants every privilege on a new table in `public` to `anon` and
-- `authenticated`. That key ships to the browser — it is public by design — so
-- before this migration anyone holding it could `delete from careers`. Every
-- table that matters carries a foreign key into these five, so emptying one does
-- not degrade the product, it stops it: not a single translation could be
-- recorded afterwards. `db/schema.test.ts` reproduces that deletion against a
-- real engine, which is how the hole was confirmed rather than assumed.
--
-- Two independent locks go on, because they fail differently:
--
--   Row level security decides which rows a role may touch, and starts at
--   deny-all. A `select` policy reopens exactly the read.
--
--   The grants decide which commands the role may attempt at all. Revoking the
--   writes means that the day someone replaces the policy below with
--   `for all using (true)`, the writes stay shut anyway.
--
-- Neither lock touches the server: `service_role` carries `bypassrls`, so the
-- boundary in `src/server/db/supabase.ts` reads these tables exactly as before.
-- Foreign key checks are internal and are not subject to row level security
-- either, so `record_translation` keeps validating `career` against `careers`.

-- ------------------------------------------------------- 1. deny-all by default

alter table input_languages  enable row level security;
alter table locales          enable row level security;
alter table careers          enable row level security;
alter table tones            enable row level security;
alter table phrase_cards     enable row level security;

-- --------------------------------------------------- 2. reopen the read, only

-- `for select` and nothing else. These rows are a catalogue — that the career
-- "Data Science" exists leaks nothing about anybody.
create policy input_languages_public_read on input_languages
  for select to anon, authenticated using (true);

create policy locales_public_read on locales
  for select to anon, authenticated using (true);

create policy careers_public_read on careers
  for select to anon, authenticated using (true);

create policy tones_public_read on tones
  for select to anon, authenticated using (true);

create policy phrase_cards_public_read on phrase_cards
  for select to anon, authenticated using (true);

-- ------------------------------------------- 3. take the write commands away

revoke insert, update, delete, truncate
  on input_languages, locales, careers, tones, phrase_cards
  from anon, authenticated;
