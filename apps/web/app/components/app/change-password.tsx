import { ChangePassword } from "@hannibox/shared"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"

import { AuthInput, fieldErrors, focusFirstError } from "~/components/app/auth-field"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { type AuthErrors, authClient, authErrors } from "~/lib/auth-client"
import { OFFLINE } from "~/lib/query"

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

  function refuse(found: AuthErrors) {
    setErrors(found)
    focusFirstError(form.current, found)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const checked = ChangePassword.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!checked.success) return refuse(fieldErrors(checked.error))

    setSaving(true)
    try {
      const { error } = await authClient.changePassword({
        currentPassword: checked.data.currentPassword,
        newPassword: checked.data.password,
        revokeOtherSessions: true,
      })
      if (error) return refuse(authErrors(error))
      onOpenChange(false)
      toast.success("Password changed", { description: "Your other devices are signed out." })
    } catch {
      refuse({ form: OFFLINE })
    } finally {
      setSaving(false)
    }
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
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>
            Every other device signed in to your account will be signed out.
          </DialogDescription>
        </DialogHeader>
        <form ref={form} noValidate onSubmit={save} className="flex flex-col gap-4">
          {/* Lets a password manager know whose password this is. */}
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
          <p className="text-sm text-destructive empty:hidden" role="alert">
            {errors.form}
          </p>
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={saving}>
              Save the new password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
