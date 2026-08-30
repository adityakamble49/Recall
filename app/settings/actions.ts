"use server";

import { auth } from "@/auth";
import { revokeExtensionCredential } from "@/lib/extension-auth";

export async function revokeExtensionConnection(credentialId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!Number.isSafeInteger(credentialId) || credentialId <= 0) throw new Error("Invalid credential");
  await revokeExtensionCredential(credentialId, session.user.id);
}
