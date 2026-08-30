import { Check, ExternalLink, ShieldCheck, X } from "lucide-react";

import { auth, signIn } from "@/auth";
import { completeExtensionAuthorization } from "./actions";
import {
  validateExtensionAuthorizationRequest,
  type ExtensionAuthorizationRequest,
} from "@/lib/extension-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExtensionAuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const values = await searchParams;
  const request: ExtensionAuthorizationRequest = {
    redirectUri: singleValue(values.redirect_uri),
    state: singleValue(values.state),
    codeChallenge: singleValue(values.code_challenge),
    codeChallengeMethod: singleValue(values.code_challenge_method),
  };
  const validation = validateExtensionAuthorizationRequest(request);

  if (!validation.valid) {
    return (
      <div className="max-w-md mx-auto px-6 py-20">
        <div className="flex items-center gap-3 text-destructive mb-4">
          <X className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Authorization request rejected</h1>
        </div>
        <p className="text-sm text-secondary leading-relaxed">
          This extension could not be verified. Close this window and start the connection again from the official Recall extension.
        </p>
      </div>
    );
  }

  const session = await auth();
  const returnTo = `/extension/authorize?${new URLSearchParams({
    redirect_uri: request.redirectUri,
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: request.codeChallengeMethod,
  })}`;

  return (
    <div className="max-w-lg mx-auto px-6 py-16 md:py-24">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted">Chrome extension</p>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Connect Recall for Chrome</h1>
        </div>
      </div>

      <p className="text-sm text-secondary leading-relaxed mb-8">
        Connect the official Recall extension to save and open bookmarks from Chrome.
      </p>

      <div className="border-y border-border py-6 space-y-4 mb-8">
        <Permission text="Read your Recall collections and bookmarks" />
        <Permission text="Save the current tab and selected tab groups" />
        <Permission text="Open saved bookmarks as Chrome tab groups" />
      </div>

      {session?.user?.id ? (
        <form action={completeExtensionAuthorization} className="space-y-3">
          <input type="hidden" name="redirect_uri" value={request.redirectUri} />
          <input type="hidden" name="state" value={request.state} />
          <input type="hidden" name="code_challenge" value={request.codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={request.codeChallengeMethod} />
          <button
            type="submit"
            name="decision"
            value="approve"
            className="w-full px-4 py-3 bg-primary text-void text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Authorize Extension
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="w-full px-4 py-2.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <p className="text-center text-xs text-muted pt-2">
            Signed in as {session.user.email ?? session.user.name ?? "your Recall account"}
          </p>
        </form>
      ) : (
        <form action={async () => {
          "use server";
          await signIn("google", { redirectTo: returnTo });
        }}>
          <button
            type="submit"
            className="w-full px-4 py-3 bg-primary text-void text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Sign in to continue <ExternalLink className="w-4 h-4" />
          </button>
        </form>
      )}

      <p className="text-xs text-muted leading-relaxed mt-8">
        You can revoke this connection at any time from Recall Settings.
      </p>
    </div>
  );
}

function Permission({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 text-sm text-secondary">
      <Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
      <span>{text}</span>
    </div>
  );
}

function singleValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
