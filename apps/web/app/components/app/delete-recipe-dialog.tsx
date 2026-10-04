import { useNavigate } from "react-router"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Spinner } from "~/components/ui/spinner"
import { useUser } from "~/hooks/use-user"
import { draftStore } from "~/lib/drafts"
import { useDeleteRecipe } from "~/lib/recipes"

export type DoomedRecipe = { id: string; title: string }

/** Asks once, then deletes. A recipe's versions move up to its parent, so nothing else is lost. */
export function DeleteRecipeDialog({
  recipe,
  openId,
  onClose,
}: {
  recipe: DoomedRecipe | null
  /** The recipe on screen: deleting it also leaves its page. */
  openId?: string
  onClose: () => void
}) {
  const user = useUser()
  const navigate = useNavigate()
  const remove = useDeleteRecipe()

  const confirm = () => {
    if (!recipe) return
    remove.mutate(recipe.id, {
      onSuccess: () => {
        draftStore.clear(user.id, recipe.id)
        toast.success("Recipe deleted", { description: recipe.title })
        onClose()
        if (recipe.id === openId) void navigate("/")
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <AlertDialog open={recipe !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{recipe?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Its photos and any draft on this device go with it. Versions made from it stay, and move
            up to its parent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={remove.isPending}>
            {remove.isPending && <Spinner data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
