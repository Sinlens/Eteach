-- Signing in has to decide which profile the account ends up on.
--
-- `20260927060000_complete_sign_in.sql` took that profile as an argument, which
-- quietly assumed it already existed. On the very first sign-in it does not:
-- there is no account profile anywhere, and the caller has nothing to pass.
--
-- Creating a fresh one there would be the wrong answer, and an expensive one —
-- everything the person collected before they had an account is on the profile
-- in front of them, and a new row beside it strands all of it. So that profile
-- becomes the account's. This is what `20260926120000_initial_schema.sql` meant
-- by a sign-in setting `user_id` on the existing row; it is true for the first
-- device, and the merge is what the ones after it need.
--
-- Taking the user rather than the profile also removes the caller's chance to
-- pass the wrong one. There is no profile to look up and get wrong: this
-- decides, and returns what it decided.
drop function complete_sign_in(uuid, text, uuid);

create function complete_sign_in(
  p_pending_id  uuid,
  p_email       text,
  p_user_id     uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pending   public.pending_sign_ins%rowtype;
  v_donor     public.profiles%rowtype;
  v_survivor  uuid;
begin
  select * into v_pending from public.pending_sign_ins where id = p_pending_id;

  if not found then
    raise exception 'complete_sign_in: no such pending sign-in';
  end if;

  if v_pending.completed_at is not null then
    raise exception 'complete_sign_in: this sign-in was already completed';
  end if;

  if v_pending.expires_at <= clock_timestamp() then
    raise exception 'complete_sign_in: this sign-in has expired';
  end if;

  -- Checked rather than trusted. Without this, somebody who obtained a
  -- reference could sign in with their own address while carrying it, and fold
  -- a stranger's history into their own account.
  if lower(v_pending.email) <> lower(p_email) then
    raise exception 'complete_sign_in: the address does not match the one that asked';
  end if;

  select id into v_survivor from public.profiles where user_id = p_user_id;

  -- Ordering matters: `found` below refers to this lookup, not the one above.
  select * into v_donor from public.profiles where id = v_pending.profile_id;

  if v_survivor is null then
    if found and v_donor.user_id is null then
      update public.profiles set user_id = p_user_id where id = v_donor.id;
      v_survivor := v_donor.id;
    else
      -- The device belongs to somebody else, or is gone. Either way there is
      -- nothing here to promote, so the account starts with a profile of its
      -- own and the device keeps whatever was already on it.
      insert into public.profiles (anonymous_key, user_id)
      values (gen_random_uuid()::text, p_user_id)
      returning id into v_survivor;
    end if;
  elsif found and v_donor.user_id is null and v_donor.id <> v_survivor then
    perform public.merge_profile(v_donor.id, v_survivor);
  end if;

  -- The row belongs to the account that completed it, whichever path ran. After
  -- a merge it is already here, carried across rather than destroyed with the
  -- donor; after the paths that do not merge, this is what moves it.
  update public.pending_sign_ins
  set completed_at = clock_timestamp(),
      profile_id = v_survivor
  where id = p_pending_id;

  return v_survivor;
end;
$$;

comment on function complete_sign_in(uuid, text, uuid) is
  'Finishes a sign-in and returns the profile the account now lives on, promoting, merging or creating as the situation requires.';
