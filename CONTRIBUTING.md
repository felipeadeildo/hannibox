# Contributing

## Layout

- `apps/web`: the SPA (React Router with `ssr: false`, Tailwind, shadcn/ui).
- `apps/api`: Hono on Cloudflare Workers. It serves `/api/*` and the SPA build.
- `packages/shared`: Zod schemas and types both apps use.

The SPA calls the API through a typed Hono client in `apps/web/app/lib/api.ts`. It imports `AppType` as a type only, so no server code ends up in the bundle.

## Running

`bun run dev` starts Vite on port 5173 and `wrangler dev` on port 8787, and Vite proxies `/api` to the Worker. `bun run preview` builds the SPA and serves it from the Worker on port 8787, the same way production does.

## Checks

`bun run verify` runs typecheck, Oxlint and the Oxfmt check. Lefthook installs itself on `bun install`. It lints and formats staged files on commit and typechecks on push. Personal overrides go in `lefthook-local.yml`.

## Worker config

After changing bindings or vars in `apps/api/wrangler.jsonc`, run `bun run --filter @hannibox/api cf-typegen` and commit `worker-configuration.d.ts`. Typecheck fails while it is out of date.

`bun run deploy` builds the SPA and runs `wrangler deploy`.
