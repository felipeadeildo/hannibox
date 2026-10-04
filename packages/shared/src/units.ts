import { z } from "zod"

/** What a recipe measures in. The stored value is the id; labels are the UI's job. */
export const UNITS = ["g", "kg", "ml", "L", "cup", "glass", "tbsp", "tsp", "pinch"] as const

export const Unit = z.enum(UNITS)
export type Unit = z.infer<typeof Unit>
