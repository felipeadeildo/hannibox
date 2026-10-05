import { LIMITS } from "@hannibox/shared"

import { Textarea } from "~/components/ui/textarea"

/**
 * The steps, as plain text. A recipe's photos belong to the recipe, in their own section, and
 * are not part of what is written here.
 */
export function ContentEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (text: string) => void
}) {
  return (
    <Textarea
      id="recipe-content"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Write the steps, one to a line…"
      aria-label="Steps"
      maxLength={LIMITS.content}
      className="field-sizing-content min-h-64 resize-none rounded-2xl border-transparent bg-muted/50 px-4 py-3.5 text-base leading-7 transition-colors placeholder:leading-7 focus-visible:bg-background md:text-[0.95rem] dark:bg-muted/30"
    />
  )
}
