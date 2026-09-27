# Professional English Coach

Turns casual, direct or awkward English into natural professional American
English for technology careers — and explains why the wording changed.

Built with [Lovable](https://lovable.dev). Pushing to the connected branch syncs
back into the Lovable editor, so keep the branch in a working state.

## Status

| Layer | State |
| --- | --- |
| UI — translator, phrase library, history | Working |
| Contracts and services | Working, behind ports |
| Database schema and API functions | Deployed, and exercised end to end |
| The rewrite itself | **Mocked.** The model belongs to a later phase |

The rewriter returns authored fixtures, not model output. Everything around it —
contracts, validation, persistence, UI — is real.

## Running it

```sh
npm install
npm run dev
```

The dev server binds port 8080, falling back if that port is taken.

```sh
npm test          # unit tests + schema tests against a real PostgreSQL engine
npm run build     # production build
npm run lint
```

## Architecture

The frontend never contains business rules, prompts or credentials. It depends
on ports; adapters decide where the data actually lives.

```
src/contracts/    types + zod schemas — the single source of truth
src/services/     ports, with mock and Supabase-backed adapters
src/components/   presentational, plus one container per feature
supabase/         migrations: schema, API functions, reference data
db/               tests that run those migrations against PGlite
```

`src/services/index.ts` is the single swap point: one flag chooses between the
in-browser mock and the database.

### Why the database logic is SQL

`supabase-js` speaks PostgREST, not SQL, so repository code written as
`.from(...).insert(...)` cannot be exercised by tests. The write path lives in
database functions instead, which the test suite runs against a real PostgreSQL
engine. What is left on the client is a function name and its arguments — and
`db/rpc-parity.test.ts` checks those against the real signatures.

## Database

`supabase/config.toml` is committed, so a clone only has to point itself at a
project. The CLI needs no global install — `npx` is enough:

```sh
npx supabase link --project-ref <your-ref>
npx supabase db push
```

Against a project that is already current, `db push` finds nothing to do: the
migration history recorded there carries the same versions as the filenames
here.

Reference data (careers, tones, locales, phrase cards) ships as a migration
rather than `supabase/seed.sql`, because `seed.sql` only runs on a local
`db reset` and those rows are the targets of foreign keys the app needs.

### Identity

Identity is `profiles`, not `users`. There is no auth provider yet, so every row
hangs off a key that stands for a device rather than a person, and
`ensure_profile` turns that key into a row on first contact. Every table holding
personal rows references `profiles` rather than a user, so adding auth backfills
nothing. In `supabase` mode the server issues the key and keeps it in a cookie
the page cannot read; in `mock` mode the browser is the database and mints its
own (`src/lib/anonymous-id.ts`). Neither is a credential — a key identifies, it
does not prove — which is what the section after this one is for.

Signing in merges, it does not attach. `profiles_user_id_key` allows one
`user_id` per row, so writing it onto the profile in front of you works for the
first device and raises a unique violation on the second — an account is not a
device. The profile already holding `user_id` survives with its `profiles.id`,
because that is the key every child table points at and the one the account's
other devices already carry; the device's profile is the donor, its rows are
re-parented and the row itself is deleted.

The merge runs without asking. Whoever sits at that browser already reads the
anonymous history in the UI, so merging exposes nothing new to them — it makes
the exposure durable, portable and irreversible, and that is accepted. It also
costs something: with no confirmation there is nowhere to ask, so every conflict
needs an answer decided in advance.

One rule gives all of them. Irreversible things merge additively, reversible
things defer to the account. Content is re-parented and adds up, because none of
it can be recreated. Preferences are a single column and a single tap, so the
account's `career`, `english_level`, `preferred_tone`, `target_locale`,
`country` and languages win and the donor's are discarded — a deliberate
configuration outranks a value that may belong to a trial, or to somebody
else's turn at a shared machine. `last_seen_at` is neither and takes the greater
of the two; `created_at` stays the survivor's.

That rule also settles the only unique constraint a merge can violate.
`saved_phrases_unique_per_profile` is scoped per profile, so a phrase saved on
both sides collides: the survivor's row wins, and the copy that goes takes a
`saved_at` with it and nothing a reader would miss. Nothing else collides, which
is worth writing down because it is structural rather than lucky —
`translations.id` is a global primary key, so a translation belongs to exactly
one profile and `user_feedback_one_per_type` never has two rows to reconcile.
Scoping that key per profile would end that. All of it lives in `merge_profile`,
which is one transaction for the reason `delete_profile` is one statement, and
idempotent because a sign-in gets retried and a donor already gone is not an
error. It refuses two things outright: a profile folded into itself, which `on
delete cascade` would empty, and a donor that already holds a `user_id`, which
would be two accounts and the loss of one.

The session is part of that change, not a later one. `ensure_profile` creates a
profile when it finds none, which is correct for a first visit and a trap after
a merge: a device still sending its deleted key gets a new empty profile instead
of an error, and the person watches their history vanish while every log stays
quiet. Merging automatically makes that the main path rather than an edge case,
so a server-issued session has to take over from the anonymous key in the same
change. `resetAnonymousId` already exists for the delete path and is what clears
the stale key.

Retention needs nothing from this: re-parenting touches `profile_id` only, so
`created_at` survives and `maintenance.anonymize_expired_content` keeps counting
from the same day.

### Authentication

What exists is everything the database side of this needs: identity reaches the
server in a cookie and no server function takes it as an argument,
`merge_profile` folds one profile into another, and `start_sign_in` and
`complete_sign_in` hold the request together. What is missing is the part that
talks to Supabase Auth and to the browser — sending the link, the callback that
completes it, and the session the waiting device picks up. It was all written
down first because the decisions below constrain each other, and discovering
that while writing the code is how half of them end up being made by accident.

Signing in is optional and stays optional. The tool works without an account the
way a translator does, which is why `profiles.user_id` is nullable and why a
merge exists at all — if signing in were a gate there would be nothing collected
in advance to merge. So there are no route guards, and no capability is held
back behind an account: what an account buys is continuity across devices, not
features.

The credential is a magic link, and there is no password. That is only a safe
choice because signing in is optional. A magic link's usual worst failure is
being locked out, and here a link that never arrives leaves somebody working
anonymously with their history intact, free to try again later. It also
collapses the two flows that need email — signing in, and resetting a password —
into one.

Supabase Auth issues and refreshes the token and does nothing else.
Authorization stays where access control already puts it: policies remain
deny-all, the server keeps the service role key, and the browser never talks to
PostgREST. Anonymous sign-ins and manual linking stay disabled, and not by
accident — Supabase links an identity onto one user, which cannot express a
merge where two identities that both already exist have to become one.
`profiles.user_id` references `auth.users`, and the empty `users` table the
initial schema created as a placeholder goes when this arrives, because two
tables holding the truth about an email address is one too many.

Identity travels in a cookie the server sets, for everybody rather than only for
accounts. That is not a detail of signing in, it is the part that has to change
first: every server function in `src/services/remote/data-functions.ts` takes
`anonymousKey` in its payload today, and the schema in front of it validates the
shape of that key and never its ownership — a caller says who it is and is
believed. The cookie holds one of two valid states, a device or an account, and
the server resolves a `profile_id` from either. That is also what makes the
merge implementable at all, because a client that keeps sending the donor's key
in a payload can never be told to stop.

A clickable link completes wherever it is opened, which is rarely where it was
asked for — somebody reading mail on a phone signs in there while the history
worth keeping sits on the laptop. So requesting a link writes a pending sign-in
that binds the request to the requesting device's profile, and the link carries
an opaque reference to it. The merge then follows the request rather than the
click.

That record has a second job, and it is not a convenience. Once the merge runs
the laptop holds the key of a profile that no longer exists, and
`ensure_profile` answers a key it cannot find by creating a profile rather than
by refusing — so the device that started the sign-in has to learn that it
finished and claim its own session. A six digit code would have removed the need
for the record entirely by completing in the browser that asked for it. The link
is friendlier, and this is what it costs.

Sessions should be long. An hour suits a product people sign into as a matter of
routine, and this one is signed into once, deliberately, to stop having to carry
a device around; the refresh token rotation already configured is what keeps a
long session safe. Magic links redirect to `site_url`, so it has to name where
the app actually runs in every environment, and the built-in mail is rate
limited hard enough to interrupt development — an SMTP sender is needed before
the first real person is.

Nothing has to be migrated. Moving the key out of `localStorage` would orphan
every profile collected before the change, and there are none: the rewrite is
still mocked and nobody has been onboarded.

### Access control

Every table holding user data has row level security enabled and no policies at
all, which denies everything. The only way in is the server, which holds the
service role key. Real policies get written together with the auth provider.

Every function pins `search_path = ''` and names its schemas in full, so a
caller cannot decide which `profiles` a function means. That matters less while
they are all `SECURITY INVOKER`; it matters a great deal the day one of them is
not, which is why `db/schema.test.ts` asserts the pin rather than trusting it.

The taxonomies are the exception: they are public reference data, so each one
carries a single `select` policy and nothing else. Their write privileges are
revoked at the grant level as well, because Supabase hands `anon` every
privilege on a new table in `public` — and since every table that matters has a
foreign key into them, one `delete from careers` sent from a browser would stop
the product rather than degrade it.

### Retention

This stores what people actually write, which can include employer names,
project detail and recruiter names. After ninety days that text is emptied:

```sql
select maintenance.anonymize_expired_content(90);
```

It anonymises rather than deletes, because those are not the same obligation.
What has to go is the wording somebody typed. What has no reason to go is that a
rewrite happened, for which career, in which tone — and `translation_outcomes`
answers whether the wording was good enough to send unedited, which is how the
product learns whether it works. Deleting the parent row takes that answer with
it through `on delete cascade`.

An anonymised row stops appearing in `list_history`, and that is not a
refinement. `translationRecordSchema` requires a non-empty `inputText` and a
whole `RewriteResponse`, and `src/server/db/rows.ts` parses every row rather
than casting it — so an emptied row reaching that parser would throw and take
the whole history with it. Once the content is gone there is nothing to show,
which is also the honest answer to give.

`saved_phrases` is deliberately outside the window: a saved phrase is a library
somebody chose to build, not a by-product of using the app. It belongs to the
on-demand delete path, which is still to be written.

The routine lives in its own `maintenance` schema. Only `public` and
`graphql_public` are exposed through PostgREST, so the job cannot be reached
with an API key, and `db/rpc-parity.test.ts` keeps asserting that `public`
holds exactly the functions the client calls.

The schedule is not a migration — a cron entry belongs to a deployed project,
not to every developer's database. It is created once per project:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'anonymize-expired-content',
  '17 3 * * *',
  $$ select maintenance.anonymize_expired_content(90) $$
);
```

## Environment

Copy `.env.example` to `.env`. `VITE_DATA_BACKEND` defaults to `mock`, which
needs no infrastructure. Set it to `supabase` and supply `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` as **server** secrets — never `VITE_`-prefixed. With
that prefix they would be inlined into the browser bundle, and the service role
key bypasses row level security by design.

That rule has a consequence in development. Vite reads only `VITE_` variables
out of `.env`, and it puts them in the client bundle, never in `process.env` —
which is where `src/server/db/supabase.ts` looks. So the `dev` script starts
Vite through Node's `--env-file-if-exists`, which loads the whole file into the
server process.

Deployed, none of that applies: the host supplies real environment variables,
and both of these have to be set there. Without them every server function
throws before it reaches the database.

## Built with

TanStack Start · React · TypeScript · Tailwind CSS · Zod · Supabase · Vitest
