import { redirect } from "next/navigation";

/** Email token reset is disabled; use Settings → Change password when signed in. */
export default function ResetPasswordPage() {
  redirect("/login");
}
