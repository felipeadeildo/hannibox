import { Unit } from "@hannibox/shared"
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { z } from "zod"

import type { RecipeDetail, RecipeFields } from "./recipes"

// An edit is never sent as you type. It stays on this device as a draft, and saving it makes a new
// version.

const Line = z.object({ name: z.string(), quantity: z.number(), unit: Unit.nullable() })

const Section = z.object({
  // Tells sections apart on this device while one is renamed or moved. It is never sent.
  key: z.string(),
  // Empty for a section without a name, which only the first one can be.
  title: z.string(),
  lines: z.array(Line),
})

const Fields = z.object({
  title: z.string(),
  content: z.string(),
  source: z.string(),
  yield: z.number().nullable(),
  yieldUnit: Unit.nullable(),
  sections: z.array(Section),
  // The photos of the saved recipe that this version leaves out. Nothing is deleted until it is saved.
  removedImages: z.array(z.string()).default([]),
  // Photos added here. They live on this device until the draft is saved, and belong to no recipe.
  addedImages: z
    .array(z.object({ id: z.string(), name: z.string(), type: z.string() }))
    .default([]),
  touchedAt: z.number(),
})

// A draft kept from before sections has one flat list of lines. It opens as one section without a
// name, so nothing typed into it is lost.
const Draft = z.preprocess(fromFlatList, Fields)

function fromFlatList(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("ingredients" in value)) return value
  const { ingredients, ...rest } = value
  const lines = Array.isArray(ingredients) ? ingredients : []
  return { ...rest, sections: lines.length > 0 ? [{ key: "s0", title: "", lines }] : [] }
}

export type Draft = z.infer<typeof Fields>
export type DraftSection = z.infer<typeof Section>
export type DraftLine = z.infer<typeof Line>

/** A draft of a recipe that does not exist yet. Its id never reaches the API. */
const LOCAL = "new-"
export const newDraftId = () => `${LOCAL}${crypto.randomUUID().slice(0, 8)}`
export const isLocalId = (id: string) => id.startsWith(LOCAL)

export const emptyDraft = (): Draft => ({
  title: "",
  content: "",
  source: "",
  yield: null,
  yieldUnit: null,
  sections: [],
  removedImages: [],
  addedImages: [],
  touchedAt: 0,
})

export const draftOf = (recipe: RecipeDetail): Draft => ({
  title: recipe.title,
  content: recipe.content,
  source: recipe.source ?? "",
  yield: recipe.yield,
  yieldUnit: recipe.yieldUnit,
  sections: recipe.sections.map(({ title, lines }, index) => ({
    key: `s${index}`,
    title: title ?? "",
    lines: lines.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
  })),
  removedImages: [],
  addedImages: [],
  touchedAt: 0,
})

/**
 * The draft as the API takes it. The photos that stay are named only when some were left out;
 * otherwise every photo stays.
 */
export const fieldsOf = (draft: Draft, base?: RecipeDetail): RecipeFields & { title: string } => ({
  title: draft.title.trim(),
  content: draft.content,
  source: draft.source.trim() || null,
  yield: draft.yield,
  yieldUnit: draft.yield === null ? null : draft.yieldUnit,
  sections: draft.sections.map(({ title, lines }) => ({ title: title || null, lines })),
  ...(base && draft.removedImages.length > 0
    ? {
        images: base.images
          .map((photo) => photo.id)
          .filter((photo) => !draft.removedImages.includes(photo)),
      }
    : {}),
})

const same = (a: Draft, b: Draft) =>
  JSON.stringify([
    a.title,
    a.content,
    a.source,
    a.yield,
    a.yieldUnit,
    a.sections.map(({ title, lines }) => [title, lines]),
    a.removedImages,
    a.addedImages.map((photo) => photo.id),
  ]) ===
  JSON.stringify([
    b.title,
    b.content,
    b.source,
    b.yield,
    b.yieldUnit,
    b.sections.map(({ title, lines }) => [title, lines]),
    b.removedImages,
    b.addedImages.map((photo) => photo.id),
  ])

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
if (typeof window !== "undefined") window.addEventListener("storage", notify)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

const prefix = (userId: string) => `hannibox:${userId}:draft:`

function parse(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = Draft.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** What is stored right now, not what some render saw: callbacks like an Undo run later. */
const peek = (userId: string, id: string) => parse(localStorage.getItem(prefix(userId) + id))

function store(userId: string, id: string, draft: Draft | null) {
  const key = prefix(userId) + id
  if (draft) localStorage.setItem(key, JSON.stringify(draft))
  else localStorage.removeItem(key)
  notify()
}

export function useDrafts(userId: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const entries: [string, string | null][] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix(userId))) {
          entries.push([key.slice(prefix(userId).length), localStorage.getItem(key)])
        }
      }
      return JSON.stringify(entries)
    },
    () => "[]",
  )
  return useMemo(() => {
    const drafts = new Map<string, Draft>()
    for (const [id, raw] of JSON.parse(snapshot) as [string, string | null][]) {
      const draft = parse(raw)
      if (draft) drafts.set(id, draft)
    }
    return drafts
  }, [snapshot])
}

/**
 * The stored draft if there is one, else the recipe itself. `base` is null for a recipe that is not
 * saved yet.
 */
export function useWorkingCopy(userId: string, id: string, base: RecipeDetail | null) {
  const stored = useDrafts(userId).get(id) ?? null
  const original = useMemo(() => (base ? draftOf(base) : emptyDraft()), [base])
  const working = stored ?? original

  const originalRef = useRef(original)
  useEffect(() => {
    originalRef.current = original
  })

  return {
    working,
    isDraft: stored !== null,
    /** Changes the copy. Given a function, it gets the copy as it is at that moment. */
    update: (changes: Partial<Draft> | ((current: Draft) => Partial<Draft>)) => {
      const current = peek(userId, id) ?? originalRef.current
      const next = {
        ...current,
        ...(typeof changes === "function" ? changes(current) : changes),
        touchedAt: Date.now(),
      }
      // Putting everything back the way it was ends the draft by itself.
      store(userId, id, same(next, originalRef.current) ? null : next)
    },
    discard: () => store(userId, id, null),
    restore: (draft: Draft) => store(userId, id, draft),
  }
}

export const draftStore = {
  put: (userId: string, id: string, draft: Draft) => store(userId, id, draft),
  clear: (userId: string, id: string) => store(userId, id, null),
}
