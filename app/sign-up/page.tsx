import { redirect } from "next/navigation";

// Sign-up and sign-in are the same username-only flow in this local-only
// build — there's no separate account-creation step yet.
export default function SignUpPage() {
  redirect("/sign-in");
}
