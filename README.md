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

### Access control

Every table holding user data has row level security enabled and no policies at
all, which denies everything. The only way in is the server, which holds the
service role key. Real policies get written together with the auth provider.

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
