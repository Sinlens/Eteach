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
| Database schema and API functions | Written and tested, not yet deployed |
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

```sh
supabase init                              # creates config.toml next to the migrations
supabase link --project-ref <your-ref>
supabase db push
```

Reference data (careers, tones, locales, phrase cards) ships as a migration
rather than `supabase/seed.sql`, because `seed.sql` only runs on a local
`db reset` and those rows are the targets of foreign keys the app needs.

Row level security is enabled on every table holding user data, with no
policies: nothing is reachable except through the server, which holds the
service role key. Policies get written together with the auth provider.

## Environment

Copy `.env.example` to `.env`. `VITE_DATA_BACKEND` defaults to `mock`, which
needs no infrastructure. Set it to `supabase` and supply `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` as **server** secrets — never `VITE_`-prefixed.

## Built with

TanStack Start · React · TypeScript · Tailwind CSS · Zod · Supabase · Vitest
