-- The delete path.
--
-- `20260926120000_initial_schema.sql` asked for two things before real users
-- arrive. `20260927010000_content_retention.sql` built the window; this is the
-- other one — somebody deciding, now, that they want none of it kept.
--
-- There is deliberately almost nothing here. Every table holding personal rows
-- references `profiles` with `on delete cascade`, which was a decision taken in
-- the initial schema, so one statement removes a person's whole footprint
-- atomically. Re-implementing that as a sequence of deletes would add a second
-- place for the truth to live and a window where half of it is gone.
--
-- `db/delete-path.test.ts` asserts the cascade is still complete rather than
-- only asserting the delete worked: a table added later without that clause
-- would orphan rows while this function kept reporting success.
--
-- SECURITY INVOKER like every other function here. The server calls it with the
-- secret key; once auth and policies exist, the same function works for a
-- signed-in user unchanged.
create function delete_profile(p_profile_id uuid)
returns void
language sql
as $$
  delete from profiles where id = p_profile_id;
$$;

comment on function delete_profile(uuid) is
  'Removes a profile and, through on delete cascade, everything stored against it.';
