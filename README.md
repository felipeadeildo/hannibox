<div align="center">

<img src="apps/web/public/favicon.svg" width="64" height="64" alt="" />

# hannibox

A recipe box where every change is a version.

[hannibox.aldeido.workers.dev](https://hannibox.aldeido.workers.dev)

<br />

<img src="apps/web/public/og.png" width="820" alt="A version tree: a banana bread, the versions made from it, and a draft that is not saved yet." />

</div>

<br />

## The idea

You bake your grandmother's banana bread. The next time you add walnuts. A week later you cut the sugar, and then you try browning the butter. Every change was an improvement, and now you can't say what the original tasted like or which change made it better.

hannibox keeps all of it. A recipe is a tree. The original is the root, and each change you save becomes a new version under the one you started from. Nothing is overwritten unless you ask for it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/workspace-dark.webp" />
  <img src="docs/images/workspace-light.webp" alt="The recipe list on the left and banana bread with walnuts open on the right, with its ingredients." />
</picture>

## Change a recipe without fear

Open any recipe and edit it. Nothing reaches the server while you do. What you change is a draft that stays on your device, photos included, and it survives a reload. A bar at the bottom says so and gives you two ways out: discard the draft or save it.

<img src="docs/images/draft.webp" width="760" alt="A banana bread draft with a new cinnamon line and an Unsaved draft bar with Discard and Save as new version." />

## Save it as a version

Saving makes a new recipe under the one you opened, with the ingredients and the photos you kept. The original stays as it was. The versions panel draws the tree, lights the path from the original to where you are, and shows the draft as a dashed node.

Overwriting is there for fixing a typo in place, and its menu tells you when it would delete a photo.

<img src="docs/images/versions.webp" width="380" alt="The versions panel: banana bread, its walnut version marked You are here, a sibling version, and a dashed draft node." />

## Write ingredients the way you say them

Type "1/2 tsp cinnamon" and hannibox reads an amount, a unit and a name, and shows what it understood before you add it. Ingredients are shared between recipes, so the field suggests the ones you already use. The 1x, 2x and 3x buttons scale the amounts you see without changing what is saved.

<img src="docs/images/quick-add.webp" width="760" alt="The ingredient field with 1/2 tsp cinnamon typed in, read as half a teaspoon of cinnamon." />

## Made for the counter

The list and the recipe take turns on a narrow screen, buttons and fields grow on touch screens, and there is a dark theme. Drag the handle to reorder ingredients.

<img src="docs/images/phones.webp" width="860" alt="Three phone screens: the recipe list, a recipe with its ingredients, and the versions panel." />

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

How the repo is laid out, the API routes and the database workflow are in [CONTRIBUTING.md](CONTRIBUTING.md). The tables are drawn in [packages/db/schema.md](packages/db/schema.md).
