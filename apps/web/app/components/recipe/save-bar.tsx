import { HugeiconsIcon } from "~/components/app/icon"
import { ArrowDown01Icon, GitBranchPlusIcon, Undo02Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"

import { Button } from "~/components/ui/button"
import { ButtonGroup } from "~/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Kbd } from "~/components/ui/kbd"
import { Spinner } from "~/components/ui/spinner"

export type SaveKind = "create" | "version" | "overwrite"

/**
 * Appears once there is something unsaved. Saving a saved recipe makes a new version under it,
 * which is the point of the whole thing; rewriting the version in place is the way out for a typo.
 */
export function SaveBar({
  visible,
  saved,
  saving,
  photosToDelete,
  onSave,
  onDiscard,
}: {
  visible: boolean
  saved: boolean
  saving: boolean
  /** How many photos overwriting would delete for good: the ones this draft leaves out. */
  photosToDelete: number
  onSave: (kind: SaveKind) => void
  onDiscard: () => void
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-auto px-3 pt-6 transition-[opacity,translate] duration-200 motion-reduce:transition-none md:mx-0 md:px-0",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
      // `inert`, not `aria-hidden`: the button that was just pressed still has focus, and hiding a
      // focused element from assistive technology is not allowed. Inert also takes it out of the tab order.
      inert={!visible}
      data-toast-floor
    >
      <div
        role="region"
        aria-label="Unsaved changes"
        className="flex items-center gap-2 rounded-2xl border border-draft/50 bg-popover/95 p-2 pl-4 shadow-xl ring-1 ring-foreground/5 backdrop-blur"
      >
        <span className="relative flex size-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-draft opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-draft" />
        </span>
        <p className="flex min-w-0 flex-1 flex-col text-sm leading-tight">
          <span className="font-medium">Unsaved draft</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">
            Kept on this device until you save
          </span>
        </p>
        <Button
          variant="ghost"
          onClick={onDiscard}
          disabled={saving}
          aria-label="Discard the draft"
        >
          <HugeiconsIcon icon={Undo02Icon} strokeWidth={2} data-icon="inline-start" />
          <span className="hidden sm:inline">Discard</span>
        </Button>
        {saved ? (
          <ButtonGroup>
            <Button onClick={() => onSave("version")} disabled={saving}>
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={GitBranchPlusIcon} strokeWidth={2} data-icon="inline-start" />
              )}
              <span className="sm:hidden">Save version</span>
              <span className="hidden sm:inline">Save as new version</span>
              <Kbd className="hidden bg-primary-foreground/15 text-primary-foreground md:inline-flex">
                ⌘S
              </Kbd>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon" disabled={saving} aria-label="Other ways to save" />}
              >
                <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-64">
                <DropdownMenuItem onClick={() => onSave("overwrite")}>
                  <span className="flex flex-col">
                    <span>Overwrite this version</span>
                    <span className="text-xs text-muted-foreground">
                      {photosToDelete > 0
                        ? `Fixes it in place, and deletes ${photosToDelete === 1 ? "the photo" : `${photosToDelete} photos`} you took out.`
                        : "Fixes it in place, without a new version."}
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        ) : (
          <Button onClick={() => onSave("create")} disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            Create recipe
            <Kbd className="hidden bg-primary-foreground/15 text-primary-foreground md:inline-flex">
              ⌘S
            </Kbd>
          </Button>
        )}
      </div>
    </div>
  )
}
