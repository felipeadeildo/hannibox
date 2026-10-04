import { Outlet, useParams } from "react-router"

import { RecipeList } from "~/components/app/recipe-list"
import { cn } from "cn"

// Side by side from `md` up. On a phone the list and the recipe take turns, like two screens.
export default function Workspace() {
  const { id } = useParams()

  return (
    <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(18rem,22rem)_1fr]">
      <aside
        className={cn("min-h-0 flex-col border-r bg-muted/30", id ? "hidden md:flex" : "flex")}
      >
        <RecipeList activeId={id} />
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "min-h-0 scroll-pt-16 scroll-pb-28 overflow-y-auto outline-none md:scroll-pt-4",
          id ? "block" : "hidden md:block",
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
