import { ChangePassword } from "@hannibox/shared"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import { AuthInput, FormError, fieldErrors, focusFirstError } from "~/components/app/auth-card"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Spinner } from "~/components/ui/spinner"
import { type AuthErrors, authClient, authErrors } from "~/lib/auth-client"
import { OFFLINE } from "~/lib/query"

/** What Better Auth refused, null when it took the new password. */
async function changePassword({
  currentPassword,
  password,
}: z.infer<typeof ChangePassword>): Promise<AuthErrors | null> {
  try {
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword: password,
      revokeOtherSessions: true,
    })
    return error && authErrors(error)
  } catch {
    // Better Auth answers a refusal; a throw means no answer came at all.
    return { form: OFFLINE }
  }
}

/** Asks for the password the person knows before taking a new one, and signs out their other devices. */
export function ChangePasswordDialog({
  email,
  open,
  onOpenChange,
}: {
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [errors, setErrors] = useState<AuthErrors>({})
  const [saving, setSaving] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  async function save(fields: z.infer<typeof ChangePassword>) {
    setSaving(true)
    const refused = await changePassword(fields)
    setSaving(false)
    return refused
  }

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const checked = ChangePassword.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    const refused = checked.success ? await save(checked.data) : fieldErrors(checked.error)
    if (refused) {
      setErrors(refused)
      focusFirstError(form.current, refused)
      return
    }
    onOpenChange(false)
    toast.success("Password changed", { description: "Your other devices are signed out." })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setErrors({})
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Every other device signed in to your account will be signed out.
          </DialogDescription>
        </DialogHeader>
        <form ref={form} noValidate onSubmit={change} className="flex flex-col gap-4">
          {/* Tells a password manager whose password this is. */}
          <input type="hidden" name="username" autoComplete="username" value={email} />
          <AuthInput
            name="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            autoFocus
            error={errors.currentPassword}
          />
          <AuthInput
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.password}
          />
          <FormError>{errors.form}</FormError>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
