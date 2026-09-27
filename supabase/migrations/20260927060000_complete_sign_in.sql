-- Finishes a sign-in against the device that started it.
--
-- The address is checked rather than trusted. Without it, somebody who obtained
-- a reference could sign in with their own address while carrying it, and fold
-- a stranger's history into their own account.
--
-- The merge is conditional because two of its three inputs are not always a
-- merge. Signing in on the device that already holds the account asks to fold a
-- profile into itself, which `merge_profile` refuses outright — correctly, since
-- `on delete cascade` would empty it. A device where somebody else is already
-- signed in holds their `user_id`, and none of what is on it belongs to whoever
-- is signing in now. In both cases there is nothing to merge, and the sign-in
-- still completes.
create function complete_sign_in(
  p_pending_id           uuid,
  p_email                text,
  p_survivor_profile_id  uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_pending public.pending_sign_ins%rowtype;
  v_donor   public.profiles%rowtype;
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

  if lower(v_pending.email) <> lower(p_email) then
    raise exception 'complete_sign_in: the address does not match the one that asked';
  end if;

  select * into v_donor from public.profiles where id = v_pending.profile_id;

  if found and v_donor.user_id is null and v_donor.id <> p_survivor_profile_id then
    perform public.merge_profile(v_donor.id, p_survivor_profile_id);
  end if;

  -- The row now belongs to the account that completed it, whichever path was
  -- taken above. After a merge it is already here, carried across rather than
  -- destroyed with the donor; after the two that do not merge, this is what
  -- moves it.
  update public.pending_sign_ins
  set completed_at = clock_timestamp(),
      profile_id = p_survivor_profile_id
  where id = p_pending_id;
end;
$$;

comment on function complete_sign_in(uuid, text, uuid) is
  'Finishes a sign-in, merging the device that asked into the account when there is something to merge.';
