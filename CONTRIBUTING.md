# Contributing

## Layout

- `apps/web`: the SPA (React Router with `ssr: false`, Tailwind, shadcn/ui).
- `apps/api`: Hono on Cloudflare Workers. It serves `/api/*` and the SPA build.
- `packages/auth`: the Better Auth config, email and password only.
- `packages/db`: the Drizzle schema and the D1 migrations.
- `packages/shared`: Zod schemas and types both apps use.

The SPA calls the API through a typed Hono client in `apps/web/app/lib/api.ts`. It imports `AppType` as a type only, so no server code ends up in the bundle.

## Running

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then fill BETTER_AUTH_SECRET
bun run dev
```

`bun run dev` applies pending migrations to the local D1, then starts Vite on port 5173 and `wrangler dev` on port 8787. Vite proxies `/api` to the Worker. `bun run preview` builds the SPA and serves it from the Worker on port 8787, the same way production does.

## Auth

The Worker creates the Better Auth instance per request in `apps/api/src/auth.ts`, because the D1 binding only exists inside a request. Better Auth answers under `/api/auth/*`. `requireUser` guards API routes and puts the user on the context.

In the SPA, `/auth` signs in, signs up and signs out, each through its `clientAction`. Pages that need a user go under the `routes/authed.tsx` layout, whose `clientLoader` redirects to `/auth` without a session. `useUser()` reads the user inside it.

## Database

After changing the auth config or the schema, run `bun run db:generate`. It regenerates `packages/db/src/schema.ts` from the Better Auth config, then writes a migration to `packages/db/migrations`. Commit both. `bun run dev` applies it locally, and the deploy applies it to the remote D1 before publishing.

## Checks

`bun run verify` runs typecheck, Oxlint and the Oxfmt check. Lefthook installs itself on `bun install`. It lints and formats staged files on commit and typechecks on push. Personal overrides go in `lefthook-local.yml`.

## Worker config

After changing bindings or vars in `apps/api/wrangler.jsonc`, run `bun run --filter @hannibox/api cf-typegen` and commit `worker-configuration.d.ts`. Typecheck fails while it is out of date.

`BETTER_AUTH_SECRET` is a Worker secret. Set it with `bunx wrangler secret put BETTER_AUTH_SECRET` from `apps/api`.

## Workers Builds

Cloudflare builds `main` from the repository root, with these settings under the Worker's Settings > Build:

| Setting         | Value                                  |
| --------------- | -------------------------------------- |
| Build command   | `bun run --filter @hannibox/web build` |
| Deploy command  | `cd apps/api && bun run deploy`        |
| Preview command | `cd apps/api && bunx wrangler preview` |
| Build variables | `BUN_VERSION=1.4.2`                    |

The deploy command applies D1 migrations before it publishes, so the build's API token needs **D1 (edit)** on top of the permissions Cloudflare grants by default. Add it under My Profile > API Tokens.

Previews share the production D1, so they skip migrations. Don't open a preview for a branch with a migration the production Worker can't run against.

Without `BUN_VERSION` the build image runs Bun 1.2.15. That version can't read `bun.lock` at `lockfileVersion` 2, which Bun 1.4 writes, so `bun install --frozen-lockfile` fails. Bun has no version file the build image reads, so the variable is the only way to pin it. Keep it at the version you run locally.
