import { HugeiconsIcon } from "~/components/app/icon"
import {
  ComputerIcon,
  LockPasswordIcon,
  Logout01Icon,
  Moon02Icon,
  Search01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { useState } from "react"
import { Outlet, redirect, useParams, useSubmit } from "react-router"

import { ChangePasswordDialog } from "~/components/app/change-password"
import { CommandsProvider, useCommands } from "~/components/app/commands"
import { PhotoCleanup } from "~/components/app/photo-cleanup"
import { ThemeToggle } from "~/components/app/theme-toggle"
import { Wordmark } from "~/components/app/wordmark"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "~/components/ui/kbd"
import { readSession } from "~/lib/auth-client"
import { type Theme, useTheme } from "~/lib/theme"

import type { Route } from "./+types/authed"

export async function clientLoader() {
  const session = await readSession()
  if (!session) throw redirect("/auth")
  return { user: session.user }
}

// The session does not change while the tab is open, and the API answers 401 if it ends.
// Without this the loader would ask for it again on every search and every page.
export function shouldRevalidate() {
  return false
}

export default function Authed({ loaderData }: Route.ComponentProps) {
  return (
    <CommandsProvider>
      <PhotoCleanup />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to the recipe
      </a>
      <div className="flex h-svh flex-col">
        <Header name={loaderData.user.name} email={loaderData.user.email} />
        <Outlet />
      </div>
    </CommandsProvider>
  )
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun03Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
  { value: "system", label: "System", icon: ComputerIcon },
] satisfies { value: Theme; label: string; icon: typeof Sun03Icon }[]

const asTheme = (value: string): Theme => (value === "light" || value === "dark" ? value : "system")

function Header({ name, email }: { name: string; email: string }) {
  const { openPalette } = useCommands()
  const { theme, setTheme } = useTheme()
  const submit = useSubmit()
  const inRecipe = useParams().id !== undefined
  const [changingPassword, setChangingPassword] = useState(false)

  return (
    <header
      className={cn(
        "h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b bg-background px-3 pt-[env(safe-area-inset-top)] md:flex md:h-12 md:pt-0",
        // On a phone, a recipe brings its own bar with the way back, so this one steps aside.
        inRecipe ? "hidden" : "flex",
      )}
    >
      <Wordmark className="mr-auto" />

      {/* A phone gets an icon like its neighbours; a desk gets the field-shaped button with its shortcut. */}
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={openPalette}
        aria-label="Search or create"
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="hidden text-muted-foreground sm:inline-flex"
        onClick={openPalette}
        aria-label="Search or create"
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} data-icon="inline-start" />
        Search or create
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account" />}>
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/15 font-medium text-primary">
              {name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="truncate font-medium text-foreground">{name}</span>
              <span className="truncate text-muted-foreground">{email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground">Theme</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(asTheme(value))}>
            {THEMES.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <HugeiconsIcon icon={option.icon} strokeWidth={2} />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setChangingPassword(true)}>
            <HugeiconsIcon icon={LockPasswordIcon} strokeWidth={2} />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => submit({ intent: "sign-out" }, { method: "post", action: "/auth" })}
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog
        email={email}
        open={changingPassword}
        onOpenChange={setChangingPassword}
      />
    </header>
  )
}
