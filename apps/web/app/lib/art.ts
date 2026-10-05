import { ChefHatIcon } from "@hugeicons/core-free-icons"

import { FOODS, type Food, type Icon } from "~/lib/foods"

export type { Icon }

type Art = { icon: Icon; hue: number }

type Entry = { art: Art; pattern: RegExp }

const HUES = [25, 55, 85, 150, 185, 235, 285, 340]

function hueOf(text: string): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return HUES[hash % HUES.length] ?? 185
}

/** Lower case, no accents, words split by single spaces: "Pão-de-ló" reads "pao de lo". */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** One pattern per food. Longer names come first, so "leite de coco" is tried before "leite". */
function compile(foods: Food[]): Entry[] {
  return foods.map(({ icon, hue, names }) => {
    const words = names.map(plain).sort((a, b) => b.length - a.length)
    return { art: { icon, hue }, pattern: new RegExp(`\\b(?:${words.join("|")})(?:e?s)?\\b`) }
  })
}

const ANY_FOOD = compile(FOODS)
const DISHES = compile(FOODS.filter((food) => food.dish))

/**
 * The food a name is about. The one named first wins, which reads Portuguese the right way
 * ("pão de banana" is bread). At the same spot the longer name wins, so "pimenta-do-reino" is a
 * spice and not a chili.
 */
function find(entries: Entry[], text: string): Art | undefined {
  let best: { art: Art; at: number; length: number } | undefined
  for (const { art, pattern } of entries) {
    const match = pattern.exec(text)
    if (!match) continue
    const at = match.index
    const length = match[0].length
    const better = !best || at < best.at || (at === best.at && length > best.length)
    if (better) best = { art, at, length }
  }
  return best?.art
}

/** The picture for an ingredient: what its name suggests, or a colour taken from the name. */
export function ingredientArt(name: string): Art & { known: boolean } {
  const found = find(ANY_FOOD, plain(name))
  return found ? { ...found, known: true } : { icon: ChefHatIcon, hue: hueOf(name), known: false }
}

/** The picture for a recipe: the dish its title names, else its main ingredient, else a chef's hat. */
export function recipeArt(title: string): Art {
  const text = plain(title)
  const found = find(DISHES, text) ?? find(ANY_FOOD, text)
  return found ?? { icon: ChefHatIcon, hue: hueOf(title) }
}
