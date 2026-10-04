import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
  route("auth", "routes/auth.tsx"),
  layout("routes/authed.tsx", [
    // The list stays on screen while a recipe opens beside it.
    layout("routes/workspace.tsx", [
      index("routes/workspace-index.tsx"),
      route("recipes/:id", "routes/recipe.tsx"),
    ]),
  ]),
] satisfies RouteConfig
