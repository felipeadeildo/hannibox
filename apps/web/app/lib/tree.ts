import type { TreeData } from "./recipes"

export type TreeNode = TreeData["nodes"][number]

/** One line of the tree: a saved recipe, the draft hanging off one, or the invitation to make the first version. */
export type Row = {
  id: string
  title: string
  createdAt: string | null
  depth: number
  /** The index of the row above it in the tree, null for the original. */
  parent: number | null
  /** How many versions were made from it. */
  versions: number
  kind: "saved" | "draft" | "hint"
}

/**
 * Reads the flat list as a tree, oldest branch first, which is the order the lines go in.
 * The version you are on gets one more line below its versions: its draft if it has one,
 * and otherwise the empty place where the next version would go.
 */
export function layoutTree(
  nodes: TreeNode[],
  rootId: string,
  drafts: Map<string, string>,
  currentId: string,
) {
  const children = new Map<string, TreeNode[]>()
  for (const node of nodes) {
    if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
  }

  const rows: Row[] = []
  const walk = (node: TreeNode, depth: number, parent: number | null) => {
    const index = rows.length
    const versions = children.get(node.id) ?? []
    rows.push({
      id: node.id,
      title: node.title,
      createdAt: node.createdAt,
      depth,
      parent,
      versions: versions.length,
      kind: "saved",
    })
    for (const child of versions) walk(child, depth + 1, index)
    const draftTitle = drafts.get(node.id)
    if (draftTitle !== undefined) {
      rows.push({
        id: `draft:${node.id}`,
        title: draftTitle,
        createdAt: null,
        depth: depth + 1,
        parent: index,
        versions: 0,
        kind: "draft",
      })
    } else if (node.id === currentId) {
      rows.push({
        id: `hint:${node.id}`,
        title: "",
        createdAt: null,
        depth: depth + 1,
        parent: index,
        versions: 0,
        kind: "hint",
      })
    }
  }

  const root = nodes.find((node) => node.id === rootId)
  if (root) walk(root, 0, null)
  return rows
}

/** The ids from the original down to `id`: the path the tree lights up. */
export function lineageOf(nodes: TreeNode[], id: string) {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]))
  const path: string[] = []
  for (let current: string | null | undefined = id; current; current = parents.get(current)) {
    path.unshift(current)
  }
  return path
}
