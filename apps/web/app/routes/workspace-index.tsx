import { HugeiconsIcon } from "~/components/app/icon"
import { CookBookIcon } from "@hugeicons/core-free-icons"

import { useCommands } from "~/components/app/commands"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Kbd } from "~/components/ui/kbd"

export function meta() {
  return [{ title: "Recipes · hannibox" }]
}

// Only seen beside the list: on a phone the list is the whole screen.
export default function WorkspaceIndex() {
  const { newRecipe } = useCommands()

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={CookBookIcon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Pick a recipe</EmptyTitle>
        <EmptyDescription>
          Open one from the list, or start a new one. Press <Kbd>/</Kbd> to search and <Kbd>N</Kbd>{" "}
          to start a recipe.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => newRecipe()}>New recipe</Button>
      </EmptyContent>
    </Empty>
  )
}
