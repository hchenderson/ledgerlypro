"use client";

import { getToken } from "firebase/app-check";
import type { User } from "firebase/auth";

import { appCheck } from "@/lib/firebase";

export async function authenticatedFetch(
  user: User,
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await user.getIdToken()}`);
  if (appCheck) {
    const appCheckToken = await getToken(appCheck, false);
    headers.set("x-firebase-appcheck", appCheckToken.token);
  }
  return fetch(input, { ...init, headers });
}
