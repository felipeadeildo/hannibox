import { createStore, del, get, keys, set } from "idb-keyval"
import { useEffect, useState } from "react"

// A photo added to a draft is not on the server: it belongs to no recipe until the draft is saved.
// Until then it waits here, on this device, next to the draft. It lives in IndexedDB and not in
// localStorage, because a photo is far too big for the few megabytes localStorage allows.

const store = createStore("hannibox", "photos")
const key = (userId: string, id: string) => `${userId}:${id}`

export const keepPhoto = (userId: string, id: string, file: File) =>
  set(key(userId, id), file, store)
export const loadPhoto = (userId: string, id: string) => get<File>(key(userId, id), store)

export async function dropUnusedPhotos(userId: string, inUse: Set<string>) {
  for (const stored of await keys(store)) {
    if (typeof stored !== "string" || !stored.startsWith(`${userId}:`)) continue
    if (!inUse.has(stored.slice(userId.length + 1))) await del(stored, store)
  }
}

// One address per photo for as long as the page lives, so a tile does not reload when another is added.
const addresses = new Map<string, string>()

export function usePhotoSources(userId: string, ids: string[]) {
  const [sources, setSources] = useState<Record<string, string>>({})
  const wanted = ids.join(",")

  useEffect(() => {
    let alive = true
    void (async () => {
      const found: Record<string, string> = {}
      for (const id of wanted ? wanted.split(",") : []) {
        let address = addresses.get(key(userId, id))
        if (!address) {
          const file = await loadPhoto(userId, id)
          if (file) {
            address = URL.createObjectURL(file)
            addresses.set(key(userId, id), address)
          }
        }
        if (address) found[id] = address
      }
      if (alive) setSources(found)
    })()
    return () => {
      alive = false
    }
  }, [userId, wanted])

  return sources
}
