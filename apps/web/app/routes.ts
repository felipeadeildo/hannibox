import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
  route("auth", "routes/auth.tsx"),
  layout("routes/authed.tsx", [index("routes/home.tsx")]),
] satisfies RouteConfig
