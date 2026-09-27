-- The retention window.
--
-- `20260926120000_initial_schema.sql` set the obligation:
--
--   > Retention: this stores what people actually write, which can include
--   > employer names, project detail and recruiter names. A retention window
--   > and a delete path must exist before real users are onboarded.
--
-- This is the window. The delete path is its own change.
--
-- It anonymises rather than deletes, because those two obligations are not the
-- same obligation. What has to go is the wording somebody typed. What has no
-- reason to go is that a rewrite happened, for which career, in which tone —
-- and `translation_outcomes` (§30, §31) exists to answer whether the wording
-- was good enough to send unedited, which is the question that tells you if the
-- product works at all. Deleting the parent row takes that answer with it,
-- through `on delete cascade`, right when there is finally enough of it to
-- read.
--
-- Emptying is deliberate rather than nulling: `input_text`,
-- `professional_version` and `result` are all NOT NULL, and that constraint is
-- true and worth keeping — a translation always did have input text. The row
-- keeps its shape and loses its content.

-- ------------------------------------------------------------- the marker

-- Explicit state beats inferring it from an empty string. It makes the job
-- idempotent, and it answers "was this redacted, or did someone submit a blank
-- line" without guessing.
alter table translations add column anonymized_at timestamptz null;

comment on column translations.anonymized_at is
  'When the retention window emptied this row''s text. Null means the content is still present.';

-- ---------------------------------------------------- keeping history alive
--
-- This is not a refinement, it is load-bearing. `translationRecordSchema`
-- requires `inputText` to be a non-empty string and `result` to be a whole
-- `RewriteResponse`, and `src/server/db/rows.ts` parses every row instead of
-- casting it. An emptied row reaching that parser does not render badly — it
-- throws, and takes the entire history endpoint with it for every entry the
-- person has.
--
-- So an anonymised row stops being history. That is also the honest product
-- behaviour: the content is gone, so there is nothing to show.
create or replace function list_history(p_profile_id uuid, p_limit integer default 8)
returns setof translations
language sql
stable
as $$
  select *
  from translations
  where profile_id = p_profile_id
    and anonymized_at is null
  order by created_at desc
  limit p_limit;
$$;

-- ---------------------------------------------------------- the job itself

-- Maintenance is not client API. `db/rpc-parity.test.ts` asserts that `public`
-- exposes exactly the functions the client builds calls for, and this is not
-- one of them. Its own schema keeps that guard meaningful and, because only
-- `public` and `graphql_public` are exposed, keeps the job off PostgREST
-- entirely — it cannot be reached with an API key at all.
create schema maintenance;

comment on schema maintenance is
  'Operational routines. Not exposed through PostgREST and never called by the client.';

create function maintenance.anonymize_expired_content(p_days integer default 90)
returns integer
language plpgsql
as $$
declare
  v_cutoff  timestamptz := now() - make_interval(days => p_days);
  v_count   integer;
begin
  -- Every column below holds words a person wrote. Adding a text column to
  -- these tables without adding it here is the failure this routine has: it
  -- reports success and anonymises nothing.
  update translations
  set input_text            = '',
      professional_version  = '',
      result                = '{}'::jsonb,
      anonymized_at         = now()
  where created_at < v_cutoff
    and anonymized_at is null;

  get diagnostics v_count = row_count;

  -- Follows the translation rather than its own clock: the accepted version is
  -- a copy of the same wording, so it goes when that wording goes.
  update translation_outcomes o
  set accepted_version = null
  from translations t
  where o.translation_id = t.id
    and t.anonymized_at is not null
    and o.accepted_version is not null;

  -- `skill`, `issue` and `confidence` are categories and a number. `expression`
  -- is the person's own phrasing, so it is the only one that goes.
  update learning_signals
  set expression = ''
  where created_at < v_cutoff
    and expression <> '';

  -- `saved_phrases` is deliberately absent. Those rows are a library somebody
  -- chose to build, not a by-product of using the app, and emptying them would
  -- delete a feature rather than protect a person. They are the delete path's
  -- responsibility.

  return v_count;
end;
$$;

comment on function maintenance.anonymize_expired_content(integer) is
  'Empties written content older than p_days. Returns the number of translations anonymised.';
