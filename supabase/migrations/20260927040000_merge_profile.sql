-- Signing in merges, it does not attach.
--
-- `20260926120000_initial_schema.sql` said a sign-in would set `user_id` on the
-- profile already in front of the person. That is true exactly once.
-- `profiles_user_id_key` allows one `user_id` per row, so the second device
-- raises a unique violation instead — an account is not a device, and from
-- there on a sign-in has to fold one profile into another.
--
-- Which way round is not a preference. The profile already holding `user_id`
-- survives and keeps its `profiles.id`, because that is the key every child
-- table points at and the one the account's other devices already carry. The
-- donor is the anonymous side, and it is gone by the last statement — so every
-- rule below had to be decided before this existed, because afterwards there is
-- nothing left to decide them against.
--
-- One rule gives all of them: irreversible things merge additively, reversible
-- things defer to the account. Content is re-parented and adds up, because none
-- of it can be recreated. Preferences are a single column and a single tap, so
-- the survivor's are simply left alone and the donor's go with the row.
--
-- SECURITY INVOKER like every other function here. The server calls it with the
-- secret key; once auth and policies exist it works for a signed-in user
-- unchanged.
create function merge_profile(
  p_donor_profile_id     uuid,
  p_survivor_profile_id  uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_donor public.profiles%rowtype;
begin
  -- Folding a profile into itself would re-parent every row onto the id deleted
  -- in the next statement, and `on delete cascade` would take the lot. It is
  -- never a real request, so it fails loudly rather than quietly.
  if p_donor_profile_id = p_survivor_profile_id then
    raise exception 'merge_profile: donor and survivor are the same profile';
  end if;

  select * into v_donor from public.profiles where id = p_donor_profile_id;

  -- A sign-in gets retried, and a donor that is already gone is not an error.
  if not found then
    return;
  end if;

  -- The donor is always the anonymous side. A donor with a `user_id` is a
  -- second account, and folding those together would destroy one of them —
  -- which is a decision nobody has taken.
  if v_donor.user_id is not null then
    raise exception 'merge_profile: the donor already belongs to an account';
  end if;

  -- Nothing here can collide. `translations.id` is a global primary key, so a
  -- translation belongs to exactly one profile and
  -- `user_feedback_one_per_type` never has two rows to reconcile. Scoping that
  -- key per profile would end that, and this would need the same guard the
  -- saved phrases get below.
  update public.translations
  set profile_id = p_survivor_profile_id
  where profile_id = p_donor_profile_id;

  update public.user_feedback
  set profile_id = p_survivor_profile_id
  where profile_id = p_donor_profile_id;

  update public.learning_signals
  set profile_id = p_survivor_profile_id
  where profile_id = p_donor_profile_id;

  update public.translation_outcomes
  set profile_id = p_survivor_profile_id
  where profile_id = p_donor_profile_id;

  -- `saved_phrases_unique_per_profile` is the only constraint a merge can
  -- violate, because it is the only one scoped per profile. The survivor's row
  -- wins, so a phrase they both saved is simply not moved — and the copy left
  -- behind goes with the donor through `on delete cascade`, rather than being
  -- deleted here in a second statement that could disagree with this one.
  update public.saved_phrases as donor_phrase
  set profile_id = p_survivor_profile_id
  where donor_phrase.profile_id = p_donor_profile_id
    and not exists (
      select 1
      from public.saved_phrases as survivor_phrase
      where survivor_phrase.profile_id = p_survivor_profile_id
        and survivor_phrase.phrase_key = donor_phrase.phrase_key
    );

  -- Not a preference, and "the survivor wins" is plainly wrong for it: the
  -- person was last seen on whichever device saw them last. `created_at` is
  -- left alone, because the account did start when it started.
  update public.profiles
  set last_seen_at = greatest(last_seen_at, v_donor.last_seen_at)
  where id = p_survivor_profile_id;

  delete from public.profiles where id = p_donor_profile_id;
end;
$$;

comment on function merge_profile(uuid, uuid) is
  'Folds an anonymous profile into the profile that holds the account, and removes it.';
