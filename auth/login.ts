"use server";

import { signIn as secureSignIn, signUp as secureSignUp } from "./actions";

export async function signIn(formData: FormData): Promise<never> {
  return secureSignIn(formData);
}

export async function signUp(formData: FormData): Promise<never> {
  return secureSignUp(formData);
}
