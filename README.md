<div align="center">

# hannibox

A recipe box where every change is a version.

[hannibox.aldeido.workers.dev](https://hannibox.aldeido.workers.dev)

<br />

[How it works](#how-it-works) · [Stack](#stack) · [Run it](#run-it) · [Contributing](CONTRIBUTING.md)

</div>

<br />

## Why

A recipe drifts. You add more salt, swap the flour, and a year later you can't tell what the first version was. hannibox keeps every variation in a tree. The original is the root, each save adds a child, and you can open any node to cook it or branch from it.

## How it works

- **Edits are drafts.** What you change stays on your device, photos included, until you save. Nothing reaches the server while you type.
- **Saving makes a version.** The new recipe sits under the one you opened and keeps the ingredients and the photos you left in. The original is not touched. Overwriting is there for fixing a typo in place.
- **The tree is a panel.** It lights the path from the original to where you are, and a draft shows up as a dashed node.
- **Ingredients are typed as you say them.** "2 cups flour" or "1/2 tsp salt" becomes an amount, a unit and a name. Ingredients are shared between recipes, and the amounts scale from ½x to 3x without changing what is saved.
- **It works on a phone.** The list and the recipe take turns on a narrow screen, and buttons and fields grow on touch screens.

## Stack

<div align="center">

|         |                                                            |
| ------- | ---------------------------------------------------------- |
| Web     | React Router as a SPA, TanStack Query, Tailwind, shadcn/ui |
| API     | Hono on Cloudflare Workers                                 |
| Data    | D1 with Drizzle, Better Auth for email and password        |
| Tooling | Bun workspaces, Oxlint, Oxfmt, Lefthook                    |

</div>

The API and the SPA ship as one Worker at [hannibox.aldeido.workers.dev](https://hannibox.aldeido.workers.dev). The Worker answers `/api/*` and serves the built SPA as static assets. A push to `main` deploys it through Workers Builds, which applies the D1 migrations before it publishes.

## Run it

You need [Bun](https://bun.sh).

```sh
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then fill in BETTER_AUTH_SECRET
bun run dev
```

Open http://localhost:5173. `bun run dev` applies the migrations to a local D1 first.

## Layout

```
apps/web         the SPA
apps/api         the Worker: /api/* and the static build
packages/auth    Better Auth config
packages/db      Drizzle schema, D1 migrations and schema.md
packages/shared  Zod schemas and units
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the API routes, the database workflow and the checks. The tables are drawn in [packages/db/schema.md](packages/db/schema.md).
