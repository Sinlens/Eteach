-- The pending sign-in.
--
-- A clickable link completes wherever it is opened, and that is rarely where it
-- was asked for: somebody reading mail on their phone signs in there, while the
-- history worth keeping sits on the laptop they were working on. Completing the
-- sign-in against the phone would fold an empty profile into the account and
-- leave the laptop anonymous.
--
-- So asking for a link writes down which device asked, and the link carries a
-- reference to this row. The merge then follows the request rather than the
-- click.
--
-- A six digit code typed into the browser that asked would have made all of
-- this unnecessary. The clickable link is friendlier, and this is what it costs.

create table pending_sign_ins (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles (id) on delete cascade,
  email         text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  completed_at  timestamptz null
);

-- There is deliberately no unique constraint on `profile_id`. `start_sign_in`
-- keeps one open request per device by clearing the earlier ones, and a merge
-- can hand a surviving profile a second row — a constraint here would turn that
-- into a failed sign-in for no gain, since every row is found by its own id.
create index pending_sign_ins_profile_idx on pending_sign_ins (profile_id);

alter table pending_sign_ins enable row level security;

-- Records a request and returns the reference the link will carry.
--
-- The earlier requests from the same device go: the newest link is the one the
-- person is about to use, and rows holding an email address should not pile up
-- because somebody pressed the button twice.
create function start_sign_in(
  p_profile_id    uuid,
  p_email         text,
  p_ttl_minutes   integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  delete from public.pending_sign_ins
  where profile_id = p_profile_id and completed_at is null;

  insert into public.pending_sign_ins (profile_id, email, expires_at)
  values (
    p_profile_id,
    p_email,
    clock_timestamp() + make_interval(mins => p_ttl_minutes)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function start_sign_in(uuid, text, integer) is
  'Records which device asked for a sign-in link, and returns the reference the link carries.';

-- `merge_profile` deletes the donor, and a pending sign-in hangs off it with
-- `on delete cascade`. Carrying the row across is not tidiness: without it, the
-- record that has to be marked finished is destroyed by the merge it is in the
-- middle of performing, and the device still waiting on that record waits for
-- something that no longer exists.
--
-- This is the failure a table added later invites, which is why
-- `db/merge.test.ts` now compares the tables referencing `profiles` against the
-- ones the merge is proven to carry.
create or replace function merge_profile(
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
  if p_donor_profile_id = p_survivor_profile_id then
    raise exception 'merge_profile: donor and survivor are the same profile';
  end if;

  select * into v_donor from public.profiles where id = p_donor_profile_id;

  if not found then
    return;
  end if;

  if v_donor.user_id is not null then
    raise exception 'merge_profile: the donor already belongs to an account';
  end if;

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

  update public.pending_sign_ins
  set profile_id = p_survivor_profile_id
  where profile_id = p_donor_profile_id;

  update public.saved_phrases as donor_phrase
  set profile_id = p_survivor_profile_id
  where donor_phrase.profile_id = p_donor_profile_id
    and not exists (
      select 1
      from public.saved_phrases as survivor_phrase
      where survivor_phrase.profile_id = p_survivor_profile_id
        and survivor_phrase.phrase_key = donor_phrase.phrase_key
    );

  update public.profiles
  set last_seen_at = greatest(last_seen_at, v_donor.last_seen_at)
  where id = p_survivor_profile_id;

  delete from public.profiles where id = p_donor_profile_id;
end;
$$;
