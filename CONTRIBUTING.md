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

After changing the auth config or the schema, run `bun run db:generate`. It regenerates `packages/db/src/auth.ts` from the Better Auth config, then writes a migration to `packages/db/migrations`. The recipe tables are in `packages/db/src/recipes.ts`, written by hand, and `schema.ts` joins the two. Commit both. `bun run dev` applies it locally, and the deploy applies it to the remote D1 before publishing.

## API

Every route needs a session. A failure is always `{ "error": "..." }`: 400 when the body or the query fails validation, 401 without a session, 404 for what does not exist or belongs to someone else, 413 and 415 for a bad image.

| Route                                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/recipes?q&original&cursor&limit` | The user's recipes, last edited first: `{ items, nextCursor, total }`. Send `nextCursor` back as `cursor` for the next page; it is `null` on the last one. It is a cursor and not a page number because saving a version moves a recipe to the top, which would repeat and skip recipes between pages. Each item carries its `ingredients` and `versions` counts and the `cover` image id. `original=true` leaves out the variations. |
| `POST /api/recipes`                        | Creates one. Only `title` is required. `ingredients` is the whole list, in order. A save is a form (see below).                                                                                                                                                                                                                                                                                                                       |
| `GET /api/recipes/:id`                     | The recipe, its ingredient lines with their photo, and the ids of its images.                                                                                                                                                                                                                                                                                                                                                         |
| `PATCH /api/recipes/:id`                   | Any subset of the fields. `ingredients` replaces the list, and `images` (the ids to keep) deletes the other photos. A save is a form.                                                                                                                                                                                                                                                                                                 |
| `DELETE /api/recipes/:id`                  | Takes it out of the tree: its variations move up to its parent.                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /api/recipes/:id/tree`                | `{ rootId, currentId, nodes }`: every recipe of the tree as a flat list of `{ id, parentId, title, createdAt, updatedAt }`.                                                                                                                                                                                                                                                                                                           |
| `POST /api/recipes/:id/variations`         | A copy, with its ingredients and photos, linked under it. A field replaces the copied one, and `images` names the photos to bring along (all, if left out). A save is a form.                                                                                                                                                                                                                                                         |
| `GET /api/ingredients?q`                   | For autocomplete: the first 20 names that contain `q`.                                                                                                                                                                                                                                                                                                                                                                                |
| `PUT /api/ingredients/:id/image`           | Multipart `file`. Replaces the ingredient's photo.                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /api/images/:id`                      | The bytes, cached for good because an id never changes its bytes.                                                                                                                                                                                                                                                                                                                                                                     |

A save (create, patch, variation) is a `multipart/form-data` request: the recipe fields as JSON in `data`, and the photos to add as files named `photos`. They travel together so the recipe and its photos are written, or refused, as one. A photo belongs to no recipe until a save puts it on one, and that is the only way a recipe's photos change, so the web app keeps the photos of a draft on the device (IndexedDB) and sends them when the draft is saved: a new version gets its own, and the version it came from is never touched.

An ingredient line is `{ name, quantity, unit }`. A new name creates the ingredient, so a client never creates one on its own. Images are PNG, JPEG, WebP or GIF, up to `MAX_IMAGE_BYTES` in `packages/shared`.

A write that touches several tables goes in one `db.batch`, which D1 runs as a transaction. A list of ingredient lines travels as one JSON that `json_each` unfolds, because D1 takes 100 bound parameters per query and 50 queries per invocation on the free plan.

## Icons and search

The icons, the social card, `site.webmanifest`, `robots.txt` and `sitemap.xml` are in `apps/web/public`. The title, the description and the card for every page come from `app/lib/site.ts`, and the site address is written in that file, in `robots.txt` and in `sitemap.xml`. Change all three if the address changes.

Only the sign-in page is meant to be found. `react-router.config.ts` prerenders `/auth` to its own HTML, so a crawler reads its title and description without running JavaScript, and `html_handling` in `wrangler.jsonc` serves it at `/auth` without a redirect. Recipes are private: `robots.txt` disallows `/recipes/` and `/api/`. Take the `/recipes/` line out when recipes are meant to be indexed.

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
