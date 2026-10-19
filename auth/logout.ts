"use server";

import { signOut as secureSignOut } from "./actions";

export async function signOut(): Promise<never> {
  return secureSignOut();
}

export async function logout(): Promise<never> {
  return secureSignOut();
}
