import type { MetaDescriptor } from "react-router"

export const SITE = {
  name: "hannibox",
  // Also written in public/robots.txt and public/sitemap.xml, which cannot import this.
  url: "https://hannibox.aldeido.workers.dev",
  title: "hannibox: a recipe box that keeps every version",
  tagline: "A recipe box where every change is a version.",
  description:
    "A recipe box where every change is a version. Edit a recipe, save it as a new one under the original, and see how it grew in a tree.",
  image: "/og.png",
  imageAlt:
    "The hannibox version tree: a recipe, the versions made from it, and a draft that is not saved yet.",
}

/**
 * Everything a page needs to be found and to look right when its link is shared. A route's
 * `meta` replaces its parent's instead of merging with it, so each public route calls this.
 */
export function pageMeta({
  title,
  description = SITE.description,
  path = "/",
  canonical = true,
}: {
  title: string
  description?: string
  path?: string
  canonical?: boolean
}): MetaDescriptor[] {
  const url = SITE.url + path
  const image = SITE.url + SITE.image

  return [
    { title },
    { name: "description", content: description },
    ...(canonical ? [{ tagName: "link", rel: "canonical", href: url } as const] : []),
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE.name },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: SITE.imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ]
}
