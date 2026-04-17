import { redirect } from "next/navigation";

/** Password changes are done in Account settings while signed in. */
export default function ForgotPasswordPage() {
  redirect("/login");
}
