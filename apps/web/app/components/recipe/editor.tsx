import { HugeiconsIcon } from "~/components/app/icon"
import {
  ArrowLeft01Icon,
  BookOpen01Icon,
  Camera01Icon,
  Clock01Icon,
  CookingPotIcon,
  Delete02Icon,
  GitBranchIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  MoreHorizontalIcon,
  Notebook01Icon,
  ShoppingBasket01Icon,
} from "@hugeicons/core-free-icons"
import { CreateVariation, LIMITS, type Unit } from "@hannibox/shared"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

import { AdaptivePanel } from "~/components/app/adaptive-panel"
import { DeleteRecipeDialog, type DoomedRecipe } from "~/components/app/delete-recipe-dialog"
import { DraftPill } from "~/components/app/draft-pill"
import { AmountField, UnitPicker } from "~/components/recipe/amount-fields"
import { ContentEditor } from "~/components/recipe/content-editor"
import { Cover } from "~/components/recipe/cover"
import { Ingredients, type EditLines } from "~/components/recipe/ingredients"
import { PhotoViewer } from "~/components/recipe/photo-viewer"
import { type Photo, Photos } from "~/components/recipe/photos"
import { type SaveKind, SaveBar } from "~/components/recipe/save-bar"
import { TreeSheet } from "~/components/recipe/tree-sheet"
import { Badge } from "~/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Button, buttonVariants } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Textarea } from "~/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { useHotkey } from "~/hooks/use-hotkey"
import { useMedia } from "~/hooks/use-media"
import { useUser } from "~/hooks/use-user"
import type { Icon } from "~/lib/art"
import { draftOf, draftStore, fieldsOf, useWorkingCopy } from "~/lib/drafts"
import { longDate, timeAgo } from "~/lib/format"
import { shrinkImage } from "~/lib/image"
import { keepPhoto, loadPhoto, usePhotoSources } from "~/lib/pending-photos"
import { checkQuantity, formatQuantity, unitLabel } from "~/lib/quantity"
import { messageOf } from "~/lib/query"
import {
  type RecipeDetail,
  type SaveMode,
  type TreeData,
  treeOptions,
  useDeleteRecipe,
  useSaveRecipe,
} from "~/lib/recipes"
import { lineageOf } from "~/lib/tree"

const SCALES = [
  { value: "0.5", label: "½×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
  { value: "3", label: "3×" },
]

/**
 * A recipe, and the draft of it. Everything on this page edits the draft, on this device;
 * nothing reaches the server until it is saved, and saving makes a new version.
 * `base` is the saved recipe, and is left out for one that does not exist yet.
 */
export function RecipeEditor({ id, base }: { id: string; base?: RecipeDetail }) {
  const user = useUser()
  const navigate = useNavigate()
  const copy = useWorkingCopy(user.id, id, base ?? null)
  const { working, isDraft, update } = copy
  const save = useSaveRecipe()
  const remove = useDeleteRecipe()
  const saved = base !== undefined
  const tree = useQuery({ ...treeOptions(id), enabled: saved })

  const [scale, setScale] = useState(1)
  const [treeOpen, setTreeOpen] = useState(false)
  const [doomed, setDoomed] = useState<DoomedRecipe | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [adding, setAdding] = useState(0)

  // The photos of this version: the saved ones less what the draft leaves out, then the ones it
  // adds. None of it reaches the server until the draft is saved, and only then does a photo
  // belong to a recipe: the new version, or this one if it is overwritten.
  const pending = usePhotoSources(
    user.id,
    working.addedImages.map((photo) => photo.id),
  )
  const photos = useMemo<Photo[]>(
    () => [
      ...(base?.images ?? [])
        .filter((photo) => !working.removedImages.includes(photo.id))
        .map((photo) => ({ id: photo.id, src: `/api/images/${photo.id}`, pending: false })),
      ...working.addedImages.flatMap((photo) =>
        pending[photo.id] ? [{ id: photo.id, src: pending[photo.id] ?? "", pending: true }] : [],
      ),
    ],
    [base, working.removedImages, working.addedImages, pending],
  )

  async function addPhotos(files: File[]) {
    for (const file of files) {
      setAdding((count) => count + 1)
      try {
        // Scaled down here, because the database caps a row at 2 MB.
        const ready = await shrinkImage(file)
        const photoId = crypto.randomUUID()
        await keepPhoto(user.id, photoId, ready)
        update((current) => ({
          addedImages: [
            ...current.addedImages,
            { id: photoId, name: ready.name, type: ready.type },
          ],
        }))
      } catch (error) {
        toast.error("The photo was not added", { description: messageOf(error) })
      } finally {
        setAdding((count) => count - 1)
      }
    }
  }

  function removePhoto(photo: Photo) {
    if (photo.pending) {
      const entry = working.addedImages.find((added) => added.id === photo.id)
      update((current) => ({
        addedImages: current.addedImages.filter((added) => added.id !== photo.id),
      }))
      toast("Photo taken out of this draft", {
        action: {
          label: "Undo",
          onClick: () =>
            entry && update((current) => ({ addedImages: [...current.addedImages, entry] })),
        },
      })
      return
    }
    update((current) => ({ removedImages: [...current.removedImages, photo.id] }))
    toast("Photo taken out of this version", {
      description: "The version you started from keeps it.",
      action: {
        label: "Undo",
        onClick: () =>
          update((current) => ({
            removedImages: current.removedImages.filter((other) => other !== photo.id),
          })),
      },
    })
  }

  const edit: EditLines = (change) =>
    update((current) => ({ ingredients: change(current.ingredients) }))

  async function run(kind: SaveKind) {
    const fields = fieldsOf(working, base)
    // Checked here the way the API checks it, so a draft it would refuse never sends its photos.
    const checked = CreateVariation.safeParse(fields)
    if (!checked.success) {
      const issue = checked.error.issues[0]
      toast.error("It was not saved", { description: issue?.message })
      if (issue?.path[0] === "title") document.getElementById("recipe-title")?.focus()
      return
    }
    const draft = working
    const mode: SaveMode = kind === "create" ? { kind } : { kind, id }
    // The new photos wait on this device, so they are read back to be sent along with the fields.
    const files = (
      await Promise.all(draft.addedImages.map((photo) => loadPhoto(user.id, photo.id)))
    ).filter((file): file is File => file !== undefined)
    if (files.length !== draft.addedImages.length) {
      toast.error("A new photo is missing from this device. Take it out and add it again.")
      return
    }
    // Overwriting changes the recipe's photos for good, so there is no taking it back.
    const deleted = kind === "overwrite" ? draft.removedImages.length : 0
    const added = kind === "overwrite" ? files.length : 0
    const changesPhotos = deleted + added > 0

    try {
      const result = await save.mutateAsync({ mode, fields, photos: files })
      copy.discard()

      if (kind === "overwrite") {
        toast.success("Saved", {
          description: changesPhotos
            ? [
                added > 0 && `${added === 1 ? "A photo was" : `${added} photos were`} added.`,
                deleted > 0 &&
                  `${deleted === 1 ? "A photo was" : `${deleted} photos were`} deleted.`,
              ]
                .filter(Boolean)
                .join(" ")
            : undefined,
          action: changesPhotos
            ? undefined
            : {
                label: "Undo",
                onClick: () => {
                  if (!base) return
                  save
                    .mutateAsync({ mode, fields: fieldsOf(draftOf(base)) })
                    .then(() => draftStore.put(user.id, id, draft))
                    .catch(notUndone)
                },
              },
        })
        return
      }

      // The new recipe or version is a leaf, so deleting it puts everything back as it was.
      const undo = async () => {
        await remove.mutateAsync(result.id)
        draftStore.put(user.id, id, draft)
        void navigate(`/recipes/${id}`, { replace: true })
      }
      void navigate(`/recipes/${result.id}`, { replace: kind === "create" })
      toast.success(kind === "create" ? "Recipe created" : "Saved as a new version", {
        description: result.title,
        action: { label: "Undo", onClick: () => void undo().catch(notUndone) },
      })
    } catch (error) {
      toast.error("It was not saved", { description: messageOf(error) })
    }
  }

  function notUndone(error: unknown) {
    toast.error("It was not undone", { description: messageOf(error) })
  }

  function discard() {
    const draft = working
    copy.discard()
    toast("Draft discarded", { action: { label: "Undo", onClick: () => copy.restore(draft) } })
  }

  useHotkey("mod+s", (event) => {
    event.preventDefault()
    if (isDraft) void run(saved ? "version" : "create")
  })

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 md:gap-10 md:px-8 md:pt-8">
      <h1 className="sr-only">{working.title || "New recipe"}</h1>
      <Header
        id={id}
        base={base}
        title={working.title}
        source={working.source}
        isDraft={isDraft}
        tree={tree.data}
        onTitle={(title) => update({ title })}
        onSource={(source) => update({ source })}
        onVersions={() => setTreeOpen(true)}
        onDelete={() => base && setDoomed({ id, title: base.title })}
        cover={photos[0]}
        photoCount={photos.length}
        onCover={() => setViewing(0)}
        yieldChip={
          <YieldChip
            amount={working.yield}
            unit={working.yieldUnit}
            scale={scale}
            onChange={(amount, unit) => update({ yield: amount, yieldUnit: unit })}
          />
        }
      />

      <section className="flex flex-col gap-4" aria-labelledby="ingredients">
        <SectionTitle
          id="ingredients"
          icon={ShoppingBasket01Icon}
          title="Ingredients"
          count={working.ingredients.length}
          note={
            scale !== 1 && (
              <span className="rounded-md bg-primary/12 px-1.5 py-0.5 font-heading text-xs font-medium text-primary">
                ×{scale === 0.5 ? "½" : scale}
              </span>
            )
          }
        >
          <ToggleGroup
            value={[String(scale)]}
            onValueChange={(value) => setScale(Number(value[0] ?? 1))}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Scale the amounts"
          >
            {SCALES.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SectionTitle>
        <Ingredients lines={working.ingredients} base={base} scale={scale} onEdit={edit} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="steps">
        <SectionTitle id="steps" icon={LeftToRightListNumberIcon} title="Steps" />
        <ContentEditor value={working.content} onChange={(content) => update({ content })} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="photos">
        <SectionTitle id="photos" icon={Camera01Icon} title="Photos" count={photos.length} />
        <Photos
          photos={photos}
          adding={adding}
          onAdd={(files) => void addPhotos(files)}
          onView={setViewing}
          onRemove={removePhoto}
        />
      </section>

      <SaveBar
        visible={isDraft}
        saved={saved}
        saving={save.isPending}
        photosToDelete={working.removedImages.length}
        onSave={(kind) => void run(kind)}
        onDiscard={discard}
      />

      {saved && (
        <TreeSheet open={treeOpen} onOpenChange={setTreeOpen} currentId={id} tree={tree.data} />
      )}
      <DeleteRecipeDialog recipe={doomed} openId={id} onClose={() => setDoomed(null)} />
      <PhotoViewer
        images={photos}
        index={viewing}
        title={working.title}
        onChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}

/** True once the recipe's big name has scrolled up under the bar, and the bar can carry it. */
function useTitleGone() {
  const [gone, setGone] = useState(false)
  useEffect(() => {
    const element = document.getElementById("recipe-title")
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setGone(!entry?.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return gone
}

function SectionTitle({
  id,
  icon,
  title,
  count,
  note,
  children,
}: {
  id: string
  icon: Icon
  title: string
  count?: number
  note?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 id={id} className="flex items-center gap-2 font-medium">
        <HugeiconsIcon
          icon={icon}
          strokeWidth={2}
          className="size-[1.1rem] text-muted-foreground"
        />
        {title}
        {count !== undefined && count > 0 && (
          <span className="font-normal text-muted-foreground tabular-nums">{count}</span>
        )}
        {note}
      </h2>
      {children}
    </div>
  )
}

const chip =
  "inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-muted-foreground pointer-coarse:h-8"

function Chip({ icon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <span className={chip}>
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5" />
      {children}
    </span>
  )
}

function Header({
  id,
  base,
  title,
  source,
  isDraft,
  tree,
  onTitle,
  onSource,
  onVersions,
  onDelete,
  cover,
  photoCount,
  onCover,
  yieldChip,
}: {
  id: string
  base?: RecipeDetail
  title: string
  source: string
  isDraft: boolean
  tree: TreeData | undefined
  onTitle: (title: string) => void
  onSource: (source: string) => void
  onVersions: () => void
  onDelete: () => void
  cover?: { src: string }
  photoCount: number
  onCover: () => void
  yieldChip: ReactNode
}) {
  const { search } = useLocation()
  const titleGone = useTitleGone()
  const fine = useMedia("(pointer: fine)")

  // The versions this one grew from, oldest first. The last of them is the one it was copied from.
  const ancestors = useMemo(() => {
    if (!tree) return []
    const titles = new Map(tree.nodes.map((node) => [node.id, node.title]))
    return lineageOf(tree.nodes, id)
      .slice(0, -1)
      .map((ancestor) => ({ id: ancestor, title: titles.get(ancestor) ?? "" }))
  }, [tree, id])
  const parent = ancestors[ancestors.length - 1]
  const versions = tree?.nodes.length ?? 0

  return (
    <>
      {/* Stays at the top on a phone, so the way back and the versions are always under the thumb.
          It sits outside the header, because a sticky element only sticks inside its parent. */}
      <div className="sticky top-0 z-20 -mx-4 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-1 border-b bg-background/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur md:static md:mx-0 md:h-auto md:border-0 md:bg-transparent md:px-0 md:pt-0 md:backdrop-blur-none">
        <Link
          to={{ pathname: "/", search }}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "md:hidden")}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
          Recipes
        </Link>
        {ancestors.length > 0 ? (
          <Breadcrumb className="hidden min-w-0 md:block">
            <BreadcrumbList className="flex-nowrap">
              {ancestors.map((ancestor, index) => (
                // The separator is an <li> too, so it sits beside the item and not inside it.
                <Fragment key={ancestor.id}>
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbLink
                      render={<Link to={{ pathname: `/recipes/${ancestor.id}`, search }} />}
                      className="max-w-40 truncate"
                    >
                      {ancestor.title}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {index < ancestors.length - 1 && <BreadcrumbSeparator />}
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <span className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
            <HugeiconsIcon
              icon={base ? BookOpen01Icon : Notebook01Icon}
              strokeWidth={2}
              className="size-4"
            />
            {base ? "Original recipe" : "New recipe"}
          </span>
        )}
        {/* The name, once the big one has scrolled out from under the bar. */}
        <p
          aria-hidden={!titleGone}
          className={cn(
            "min-w-0 flex-1 truncate text-center font-heading text-sm transition-[opacity,translate] duration-200 md:hidden",
            titleGone ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          {title || "New recipe"}
        </p>
        <div className="ml-auto flex items-center gap-1">
          {base && (
            <>
              {/* On a phone, an icon like the one beside it, with the count as a badge on top. */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onVersions}
                aria-label="Versions"
                className="relative md:hidden"
              >
                <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-5" />
                {versions > 1 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
                    {versions}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onVersions}
                aria-label="Versions"
                className="hidden md:inline-flex"
              >
                <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} data-icon="inline-start" />
                Versions
                {versions > 1 && <Badge variant="secondary">{versions}</Badge>}
              </Button>
            </>
          )}
          {base && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" aria-label="More actions" />}
              >
                <HugeiconsIcon
                  icon={MoreHorizontalIcon}
                  strokeWidth={2}
                  className="max-md:size-5"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  Delete…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <header className="-mt-3 flex flex-col gap-5 md:-mt-5">
        {cover && (
          <Cover
            src={cover.src}
            alt={title || "Photo of the recipe"}
            count={photoCount}
            onOpen={onCover}
          />
        )}

        <div className="flex flex-col gap-3">
          <Textarea
            id="recipe-title"
            value={title}
            onChange={(event) => onTitle(event.target.value.replace(/\n/g, " "))}
            onKeyDown={(event) => {
              // Enter is done with the name: on to the first ingredient.
              if (event.key === "Enter") {
                event.preventDefault()
                document.getElementById("quick-add")?.focus()
              }
            }}
            placeholder="Name this recipe…"
            aria-label="Recipe name"
            rows={1}
            maxLength={LIMITS.title}
            // On a phone this would raise the keyboard before the person has chosen to type.
            autoFocus={!base && !title && fine}
            className="-mx-2 field-sizing-content min-h-0 resize-none border-transparent bg-transparent px-2 py-1 font-heading text-[1.75rem] leading-tight font-medium text-balance shadow-none hover:bg-muted/60 focus-visible:bg-muted/50 focus-visible:shadow-[0_2px_0_0_var(--primary)] focus-visible:ring-0 md:text-3xl dark:bg-transparent"
          />

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && <DraftPill />}
            {base ? (
              <Tooltip>
                <TooltipTrigger render={<span className="cursor-default" />}>
                  <Chip icon={Clock01Icon}>Edited {timeAgo(base.updatedAt)}</Chip>
                </TooltipTrigger>
                <TooltipContent>{longDate(base.updatedAt)}</TooltipContent>
              </Tooltip>
            ) : (
              <Chip icon={Notebook01Icon}>Not saved yet</Chip>
            )}
            {yieldChip}
            {parent && (
              <Link
                to={{ pathname: `/recipes/${parent.id}`, search }}
                className="md:hidden"
                aria-label={`A version of ${parent.title}`}
              >
                <Chip icon={GitBranchIcon}>
                  <span className="max-w-44 truncate">Version of {parent.title}</span>
                </Chip>
              </Link>
            )}
            <InputGroup className="h-7 w-44 max-w-full rounded-full border-transparent bg-muted text-xs focus-within:w-72 md:h-7 pointer-coarse:h-8">
              <InputGroupAddon className="pl-2.5">
                <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                value={source}
                onChange={(event) => onSource(event.target.value)}
                placeholder="Where is it from…"
                aria-label="Source"
                maxLength={LIMITS.source}
                autoComplete="off"
                className="text-xs md:text-xs"
              />
            </InputGroup>
          </div>
        </div>
      </header>
    </>
  )
}

/** How much it makes. It scales with the amounts, and clearing the amount takes it off. */
function YieldChip({
  amount,
  unit,
  scale,
  onChange,
}: {
  amount: number | null
  unit: Unit | null
  scale: number
  onChange: (amount: number | null, unit: Unit | null) => void
}) {
  const [open, setOpen] = useState(false)
  const shown = amount === null ? null : amount * scale

  return (
    <AdaptivePanel
      open={open}
      onOpenChange={setOpen}
      triggerClassName={cn(
        chip,
        "transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground",
      )}
      triggerLabel="How much it makes"
      trigger={
        <>
          <HugeiconsIcon icon={CookingPotIcon} strokeWidth={2} className="size-3.5" />
          {shown === null
            ? "Set the yield"
            : `Makes ${formatQuantity(shown)}${unit ? ` ${unitLabel(unit, shown)}` : ""}`}
        </>
      }
      title="How much it makes"
    >
      <YieldForm amount={amount} unit={unit} onChange={onChange} onDone={() => setOpen(false)} />
    </AdaptivePanel>
  )
}

function YieldForm({
  amount,
  unit,
  onChange,
  onDone,
}: {
  amount: number | null
  unit: Unit | null
  onChange: (amount: number | null, unit: Unit | null) => void
  onDone: () => void
}) {
  const [text, setText] = useState(amount === null ? "" : formatQuantity(amount))
  // Only an amount the API takes reaches the draft. While what is typed is not one, the field
  // says why, and Done waits for it.
  const typed = checkQuantity(text)
  const empty = text.trim() === ""

  return (
    <div className="flex flex-col gap-5">
      <AmountField
        label="How much it makes"
        value={text}
        unit={unit}
        optional
        onChange={(next) => {
          setText(next)
          const checked = checkQuantity(next)
          if (next.trim() === "") onChange(null, null)
          else if (checked.value !== undefined) onChange(checked.value, unit)
        }}
      />
      <UnitPicker value={unit} onChange={(next) => onChange(amount, next)} />
      <div className="flex items-center gap-2 pt-1">
        {amount !== null && (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setText("")
              onChange(null, null)
              onDone()
            }}
          >
            Remove
          </Button>
        )}
        <Button
          type="button"
          className="ml-auto min-w-24"
          disabled={!empty && typed.error !== undefined}
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  )
}
