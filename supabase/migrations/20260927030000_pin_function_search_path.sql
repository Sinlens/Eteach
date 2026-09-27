-- Pin every function's search_path.
--
-- Without this, a function resolves `profiles` against whatever schema list the
-- caller happens to have set. The exposure is small here — these are all
-- SECURITY INVOKER, so nobody gains a privilege they did not already hold — but
-- "small" depends entirely on that property staying true. The day one of these
-- is made SECURITY DEFINER, an unpinned search_path stops being hygiene and
-- becomes the hole.
--
-- `search_path = ''` rather than `= 'public'`. Both silence the linter and both
-- close the injection, but the empty string forces every name in the body to
-- say which schema it means. That is the part worth having: the protection
-- stops depending on a setting nobody will look at again, and starts being
-- visible in the code. `db/schema.test.ts` asserts the pin is present, so a
-- function added later without it fails rather than drifting.
--
-- Bodies are otherwise unchanged. The test suite exercises all of them, which
-- is what makes rewriting eleven of them at once a safe thing to do.

create or replace function ensure_profile(p_anonymous_key text)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.profiles (anonymous_key)
  values (p_anonymous_key)
  on conflict (anonymous_key) do update set last_seen_at = now()
  returning id;
$$;

create or replace function record_translation(
  p_profile_id      uuid,
  p_translation_id  text,
  p_input_text      text,
  p_career          text,
  p_tone            text,
  p_locale          text,
  p_result          jsonb
)
returns text
language sql
set search_path = ''
as $$
  insert into public.translations
    (id, profile_id, input_text, professional_version, career, tone, locale, result)
  values
    (p_translation_id, p_profile_id, p_input_text, p_result ->> 'professionalVersion',
     p_career, p_tone, p_locale, p_result)
  on conflict (id) do update set
    input_text            = excluded.input_text,
    professional_version  = excluded.professional_version,
    result                = excluded.result
  returning id;
$$;

create or replace function list_history(p_profile_id uuid, p_limit integer default 8)
returns setof public.translations
language sql
stable
set search_path = ''
as $$
  select *
  from public.translations
  where profile_id = p_profile_id
    and anonymized_at is null
  order by created_at desc
  limit p_limit;
$$;

create or replace function save_phrase(
  p_profile_id      uuid,
  p_phrase_key      text,
  p_phrase          text,
  p_meaning         text,
  p_career          text,
  p_source          text,
  p_example         text,
  p_category        text,
  p_difficulty      text,
  p_phrase_card_id  text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.saved_phrases
    (profile_id, phrase_key, phrase, meaning, example, career, category, difficulty,
     source, phrase_card_id)
  values
    (p_profile_id, p_phrase_key, p_phrase, p_meaning, p_example, p_career, p_category,
     p_difficulty, p_source, p_phrase_card_id)
  on conflict on constraint saved_phrases_unique_per_profile do update set
    phrase          = excluded.phrase,
    meaning         = excluded.meaning,
    example         = excluded.example,
    category        = excluded.category,
    difficulty      = excluded.difficulty,
    source          = excluded.source,
    phrase_card_id  = excluded.phrase_card_id;
$$;

create or replace function remove_saved_phrase(p_profile_id uuid, p_phrase_key text)
returns void
language sql
set search_path = ''
as $$
  delete from public.saved_phrases
  where profile_id = p_profile_id and phrase_key = p_phrase_key;
$$;

create or replace function list_saved_phrases(p_profile_id uuid)
returns setof public.saved_phrases
language sql
stable
set search_path = ''
as $$
  select *
  from public.saved_phrases
  where profile_id = p_profile_id
  order by saved_at desc;
$$;

create or replace function clear_history(p_profile_id uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.translations where profile_id = p_profile_id;
$$;

create or replace function record_feedback(
  p_profile_id      uuid,
  p_translation_id  text,
  p_feedback_type   text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.user_feedback (profile_id, translation_id, feedback_type)
  values (p_profile_id, p_translation_id, p_feedback_type)
  on conflict on constraint user_feedback_one_per_type do nothing;
$$;

create or replace function record_outcome(
  p_profile_id        uuid,
  p_translation_id    text,
  p_action            text,
  p_accepted_version  text default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.translation_outcomes
    (profile_id, translation_id, action, accepted_version)
  values
    (p_profile_id, p_translation_id, p_action, p_accepted_version);
$$;

create or replace function delete_profile(p_profile_id uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.profiles where id = p_profile_id;
$$;

create or replace function maintenance.anonymize_expired_content(p_days integer default 90)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_cutoff  timestamptz := now() - make_interval(days => p_days);
  v_count   integer;
begin
  update public.translations
  set input_text            = '',
      professional_version  = '',
      result                = '{}'::jsonb,
      anonymized_at         = now()
  where created_at < v_cutoff
    and anonymized_at is null;

  get diagnostics v_count = row_count;

  update public.translation_outcomes o
  set accepted_version = null
  from public.translations t
  where o.translation_id = t.id
    and t.anonymized_at is not null
    and o.accepted_version is not null;

  update public.learning_signals
  set expression = ''
  where created_at < v_cutoff
    and expression <> '';

  return v_count;
end;
$$;
