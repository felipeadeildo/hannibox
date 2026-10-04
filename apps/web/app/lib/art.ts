import {
  ApplePieIcon,
  AppleIcon,
  Bread01Icon,
  CakeIcon,
  CarrotIcon,
  CheeseIcon,
  ChefHatIcon,
  CherryIcon,
  EggFriedIcon,
  EggsIcon,
  FishIcon,
  MilkBottleIcon,
  OrangeIcon,
  Pizza01Icon,
  SaladIcon,
  SandwichIcon,
  SoupIcon,
  WheatIcon,
} from "@hugeicons/core-free-icons"

export type Icon = typeof ChefHatIcon

type Art = { icon: Icon; hue: number }

// Hues that sit well together on a white page and on a dark one.
const HUES = [25, 55, 85, 150, 185, 235, 285, 340]

function hueOf(text: string) {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return HUES[hash % HUES.length] ?? 185
}

const lookup = (table: [RegExp, Art][], text: string) =>
  table.find(([pattern]) => pattern.test(text))?.[1]

const INGREDIENTS: [RegExp, Art][] = [
  [/\bovos?\b|\beggs?\b|gema|clara/, { icon: EggsIcon, hue: 85 }],
  [/leite|milk|creme de leite|nata\b/, { icon: MilkBottleIcon, hue: 235 }],
  [/queijo|cheese|mussarela|parmes|ricota/, { icon: CheeseIcon, hue: 85 }],
  [/cenoura|carrot/, { icon: CarrotIcon, hue: 45 }],
  [/ma[çc][ãa]|apple/, { icon: AppleIcon, hue: 25 }],
  [/laranja|orange|tangerina/, { icon: OrangeIcon, hue: 55 }],
  [/cereja|cherry|morango|strawberry/, { icon: CherryIcon, hue: 15 }],
  [/peixe|fish|salm[ãa]o|atum|til[áa]pia/, { icon: FishIcon, hue: 215 }],
  [/farinha|flour|trigo|aveia|oat/, { icon: WheatIcon, hue: 75 }],
  [/p[ãa]o|bread/, { icon: Bread01Icon, hue: 55 }],
]

const RECIPES: [RegExp, Art][] = [
  [/p[ãa]o|bread|brioche|focaccia|baguete/, { icon: Bread01Icon, hue: 55 }],
  [/bolo|cake|cupcake|brownie|muffin/, { icon: CakeIcon, hue: 340 }],
  [/pizza/, { icon: Pizza01Icon, hue: 25 }],
  [/sopa|soup|caldo|ramen|creme de/, { icon: SoupIcon, hue: 45 }],
  [/salada|salad/, { icon: SaladIcon, hue: 150 }],
  [/sandu[íi]che|sandwich|burger|hamb[úu]rguer|lanche/, { icon: SandwichIcon, hue: 70 }],
  [/torta|pie\b|tarte|crumble/, { icon: ApplePieIcon, hue: 30 }],
  [/ovo|egg|omelete|omelet|fritada/, { icon: EggFriedIcon, hue: 85 }],
  [/peixe|fish|salm[ãa]o|atum|bacalhau|camar[ãa]o/, { icon: FishIcon, hue: 215 }],
  [/queijo|cheese|fondue/, { icon: CheeseIcon, hue: 85 }],
]

/** The picture for an ingredient: what its name suggests, or a colour taken from the name. */
export const ingredientArt = (name: string): Art & { known: boolean } => {
  const found = lookup(INGREDIENTS, name.toLowerCase())
  return found ? { ...found, known: true } : { icon: ChefHatIcon, hue: hueOf(name), known: false }
}

/** The picture for a recipe without a photo. */
export const recipeArt = (title: string): Art => {
  const found = lookup(RECIPES, title.toLowerCase())
  return found ?? { icon: ChefHatIcon, hue: hueOf(title) }
}
