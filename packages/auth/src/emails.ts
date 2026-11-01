/** What `createAuth` hands to whoever sends mail, so this package knows nothing of how. */
export type Email = { to: string; subject: string; text: string; html: string }

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  )

/** The link to choose a new password. It works once, for an hour (Better Auth's default). */
export function resetPasswordEmail({
  name,
  email,
  url,
}: {
  name: string
  email: string
  url: string
}): Email {
  const greeting = name.trim() ? `Hi ${name.trim()},` : "Hi,"
  const text = [
    greeting,
    "",
    "Someone asked to reset the password of your hannibox account. Open this link to choose a new one:",
    "",
    url,
    "",
    "The link works once, within the next hour. If it wasn't you, ignore this email: your password stays as it is.",
  ].join("\n")

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <p style="margin:0 0 24px;font-weight:600;font-size:16px">hannibox</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escape(greeting)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">Someone asked to reset the password of your hannibox account. Choose a new one here:</p>
      <p style="margin:0 0 24px"><a href="${escape(url)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:15px;font-weight:500">Choose a new password</a></p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#78716c">The link works once, within the next hour. If it wasn't you, ignore this email: your password stays as it is.</p>
    </div>
  </body>
</html>`

  return { to: email, subject: "Reset your hannibox password", text, html }
}
