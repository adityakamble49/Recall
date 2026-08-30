"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  issueExtensionAuthorizationCode,
  validateExtensionAuthorizationRequest,
  type ExtensionAuthorizationRequest,
} from "@/lib/extension-auth";

export async function completeExtensionAuthorization(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const request = authorizationRequestFromForm(formData);
  const validation = validateExtensionAuthorizationRequest(request);
  if (!validation.valid) throw new Error("Invalid extension authorization request");

  const callback = new URL(request.redirectUri);
  callback.searchParams.set("state", request.state);
  if (formData.get("decision") === "deny") {
    callback.searchParams.set("error", "access_denied");
    redirect(callback.toString());
  }

  const code = await issueExtensionAuthorizationCode(session.user.id, request);
  callback.searchParams.set("code", code);
  redirect(callback.toString());
}

function authorizationRequestFromForm(formData: FormData): ExtensionAuthorizationRequest {
  return {
    redirectUri: String(formData.get("redirect_uri") ?? ""),
    state: String(formData.get("state") ?? ""),
    codeChallenge: String(formData.get("code_challenge") ?? ""),
    codeChallengeMethod: String(formData.get("code_challenge_method") ?? ""),
  };
}
