import { HugeiconsIcon } from "~/components/app/icon"
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import { Button } from "~/components/ui/button"
import { useTheme } from "~/lib/theme"

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  const next = resolved === "dark" ? "light" : "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to the ${next} theme`}
      onClick={() => setTheme(next)}
      className="relative"
    >
      <HugeiconsIcon
        icon={Sun03Icon}
        strokeWidth={2}
        className="transition-[scale,rotate] duration-300 dark:scale-0 dark:-rotate-90"
      />
      <HugeiconsIcon
        icon={Moon02Icon}
        strokeWidth={2}
        className="absolute scale-0 rotate-90 transition-[scale,rotate] duration-300 dark:scale-100 dark:rotate-0"
      />
    </Button>
  )
}
