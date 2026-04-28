import { auth, signOut } from "@/auth";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ExtensionToken } from "@/components/ExtensionToken";
import Image from "next/image";
import { LogOut, Key, User } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  return (
    <div className="max-w-lg mx-auto px-6 md:px-10 py-10 md:py-16 space-y-10">
      <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>

      {/* Account */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted px-1">Account</h2>
        <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-surface">
          {session.user.image ? (
            <Image src={session.user.image} alt="" width={48} height={48} className="w-12 h-12 rounded-full border border-border" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-raised flex items-center justify-center border border-border">
              <User className="w-5 h-5 text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-primary">{session.user.name}</p>
            <p className="text-xs text-muted font-mono truncate">{session.user.email}</p>
          </div>
        </div>
      </section>

      {/* API Token */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted px-1">API Token</h2>
        <div className="p-5 border border-border rounded-xl bg-surface space-y-4 shadow-card">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-muted mt-0.5" />
            <div>
              <p className="text-sm font-medium text-primary">Personal Access Token</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">Generate a token for mobile apps or third-party integrations.</p>
            </div>
          </div>
          <ExtensionToken />
        </div>
      </section>

      {/* Sign Out */}
      <section>
        <form action={async () => { "use server"; await signOut(); }}>
          <button type="submit" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-destructive border border-destructive/20 rounded-xl hover:bg-destructive/10 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
