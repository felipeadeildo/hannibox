import { AlertCircleIcon, ChefHatIcon } from "@hugeicons/core-free-icons"
import { QueryClientProvider } from "@tanstack/react-query"
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router"

import { HugeiconsIcon } from "~/components/app/icon"
import { Button, buttonVariants } from "~/components/ui/button"
import { Toaster } from "~/components/ui/sonner"
import { TooltipProvider } from "~/components/ui/tooltip"
import { ApiFailure, queryClient } from "~/lib/query"
import { SITE, pageMeta } from "~/lib/site"
import { THEME_SCRIPT, useTheme } from "~/lib/theme"

import type { Route } from "./+types/root"
import "./app.css"

// In SPA mode only the root route is rendered into index.html, so what a crawler or a link preview
// reads without running any JavaScript is this: the title, the description and the card.
export function meta() {
  return [
    ...pageMeta({ title: SITE.title, canonical: false }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
      },
    },
  ]
}

export function links() {
  return [
    // Chrome picks the first icon whose size it likes, so the .ico declares its size to let the SVG win.
    { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
    { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    { rel: "manifest", href: "/site.webmanifest" },
  ]
}

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
        <noscript>hannibox needs JavaScript to run.</noscript>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

// The SPA shell renders this until the first route's clientLoader resolves. It is also the text
// that is in index.html for anything that does not run JavaScript.
export function HydrateFallback() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <HugeiconsIcon icon={ChefHatIcon} strokeWidth={2} className="size-7" />
      </span>
      <h1 className="font-heading text-xl font-medium tracking-tight" translate="no">
        {SITE.name}
      </h1>
      <p className="max-w-xs text-sm text-pretty text-muted-foreground">{SITE.tagline}</p>
    </main>
  )
}

export default function App() {
  const { resolved } = useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster theme={resolved} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

/** What to say about an error that broke a whole page. An API failure says why in its own words. */
function explain(error: unknown) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return {
      missing: true,
      title: "This page is not here",
      details: "The address may be wrong, or the page was taken down.",
    }
  }
  if (error instanceof ApiFailure) {
    return { missing: false, title: "Something went wrong", details: error.message }
  }
  return {
    missing: false,
    title: "Something went wrong",
    details: "It was not you. Try again, and if it keeps happening, come back in a little while.",
  }
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { missing, title, details } = explain(error)
  const stack = import.meta.env.DEV && error instanceof Error ? error.stack : undefined

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <HugeiconsIcon
        icon={AlertCircleIcon}
        strokeWidth={2}
        className="size-8 text-muted-foreground"
      />
      <div className="flex max-w-sm flex-col gap-1.5">
        <h1 className="font-heading text-xl font-medium">{title}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{details}</p>
      </div>
      {missing ? (
        <a href="/" className={buttonVariants()}>
          Back to recipes
        </a>
      ) : (
        <Button onClick={() => window.location.reload()}>Try again</Button>
      )}
      {stack && (
        <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
