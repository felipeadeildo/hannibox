import { QueryClientProvider } from "@tanstack/react-query"
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router"

import { Toaster } from "~/components/ui/sonner"
import { TooltipProvider } from "~/components/ui/tooltip"
import { queryClient } from "~/lib/query"
import { THEME_SCRIPT, useTheme } from "~/lib/theme"

import type { Route } from "./+types/root"
import "./app.css"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// The SPA shell renders this until the first route's clientLoader resolves.
export function HydrateFallback() {
  return null
}

export default function App() {
  const { resolved } = useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster position="top-center" theme={resolved} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
