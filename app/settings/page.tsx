import { auth, signOut } from "@/auth";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ExtensionToken } from "@/components/ExtensionToken";
import Image from "next/image";
import { LogOut, Puzzle, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  return (
    <div className="max-w-lg mx-auto px-6 md:px-10 py-10 md:py-16 space-y-10">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Account */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-400">Account</h2>
        <div className="flex items-center gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950">
          {session.user.image ? (
            <Image src={session.user.image} alt="" width={48} height={48} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-zinc-400 font-mono truncate">{session.user.email}</p>
          </div>
        </div>
      </section>

      {/* Chrome Extension */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-400">Chrome Extension</h2>
        <div className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 space-y-4">
          <div className="flex items-start gap-3">
            <Puzzle className="w-5 h-5 text-zinc-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Connect Extension</p>
              <p className="text-xs text-zinc-400 mt-0.5">Generate a token and paste it in the Chrome extension.</p>
            </div>
          </div>
          <ExtensionToken />
        </div>
      </section>

      {/* Sign Out */}
      <section>
        <form action={async () => { "use server"; await signOut(); }}>
          <button type="submit" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 dark:border-red-900/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
