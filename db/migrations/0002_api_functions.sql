-- The write path, as database functions.
--
-- Why functions instead of table calls from the client:
--
-- `@supabase/supabase-js` speaks PostgREST, not SQL, so repository code written
-- as `.from('x').insert(...)` cannot be exercised by the schema tests. Moving
-- the logic in here keeps it testable against a real PostgreSQL engine, and
-- leaves the client layer with nothing to get wrong but an rpc name.
--
-- All of these are SECURITY INVOKER (the default) on purpose. They must not
-- bypass row level security: the server calls them with the service role, and
-- once auth and policies exist the same functions work for a signed-in user
-- without a rewrite. Marking them SECURITY DEFINER would silently punch a hole
-- through every policy written later.

-- Returns the profile for a device, creating it on first contact.
create function ensure_profile(p_anonymous_key text)
returns uuid
language sql
as $$
  insert into profiles (anonymous_key)
  values (p_anonymous_key)
  on conflict (anonymous_key) do update set last_seen_at = now()
  returning id;
$$;

-- `professional_version` is derived from the stored payload rather than passed
-- separately, so the flattened column can never disagree with the JSON.
create function record_translation(
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
as $$
  insert into translations
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

create function list_history(p_profile_id uuid, p_limit integer default 8)
returns setof translations
language sql
stable
as $$
  select *
  from translations
  where profile_id = p_profile_id
  order by created_at desc
  limit p_limit;
$$;

-- Upsert by (profile_id, phrase_key): saving the same phrase twice is one row.
create function save_phrase(
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
as $$
  insert into saved_phrases
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

create function remove_saved_phrase(p_profile_id uuid, p_phrase_key text)
returns void
language sql
as $$
  delete from saved_phrases
  where profile_id = p_profile_id and phrase_key = p_phrase_key;
$$;

create function list_saved_phrases(p_profile_id uuid)
returns setof saved_phrases
language sql
stable
as $$
  select *
  from saved_phrases
  where profile_id = p_profile_id
  order by saved_at desc;
$$;

create function clear_history(p_profile_id uuid)
returns void
language sql
as $$
  delete from translations where profile_id = p_profile_id;
$$;

-- Feedback is idempotent: sending the same signal twice is not two signals.
create function record_feedback(
  p_profile_id      uuid,
  p_translation_id  text,
  p_feedback_type   text
)
returns void
language sql
as $$
  insert into user_feedback (profile_id, translation_id, feedback_type)
  values (p_profile_id, p_translation_id, p_feedback_type)
  on conflict on constraint user_feedback_one_per_type do nothing;
$$;

-- Phase 5 validation signal (§30, §31).
create function record_outcome(
  p_profile_id        uuid,
  p_translation_id    text,
  p_action            text,
  p_accepted_version  text default null
)
returns void
language sql
as $$
  insert into translation_outcomes
    (profile_id, translation_id, action, accepted_version)
  values
    (p_profile_id, p_translation_id, p_action, p_accepted_version);
$$;
