import { useEffect, useRef } from "react"

import { useUser } from "~/hooks/use-user"
import { useDrafts } from "~/lib/drafts"
import { dropUnusedPhotos } from "~/lib/pending-photos"

/**
 * Once, when the app opens: deletes the photos kept on this device that no draft points at any
 * more. Not before, so a discarded draft can still be brought back, with its photos.
 */
export function PhotoCleanup() {
  const user = useUser()
  const drafts = useDrafts(user.id)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const inUse = new Set(
      [...drafts.values()].flatMap((draft) => draft.addedImages.map((photo) => photo.id)),
    )
    void dropUnusedPhotos(user.id, inUse)
  }, [drafts, user.id])

  return null
}
