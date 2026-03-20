import { auth, signOut } from "@/auth";
import { SignInPrompt } from "@/components/SignInPrompt";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  return (
    <div className="max-w-md mx-auto px-6 py-8 space-y-10">
      {/* Account */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/50">Account Details</h2>
        <div className="bg-surface-container-low p-5 rounded-xl flex items-center gap-4">
          <div className="relative">
            {session.user.image ? (
              <Image src={session.user.image} alt="Avatar" width={64} height={64} className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary-container flex items-center justify-center text-on-primary text-xl font-bold">
                {session.user.name?.[0] ?? "?"}
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg text-on-surface">{session.user.name}</p>
            <p className="text-xs text-on-surface-variant">{session.user.email}</p>
          </div>
        </div>
      </section>

      {/* Chrome Extension Promo */}
      <section className="relative overflow-hidden bg-primary p-6 rounded-xl text-on-primary">
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>extension</span>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">Chrome Extension</span>
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight leading-none">Sync your world with a click.</h3>
            <p className="text-xs opacity-90 max-w-[80%] leading-relaxed">
              Save bookmarks directly from your desktop browser to Recall.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button className="w-full h-12 bg-white text-primary font-bold text-sm rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
              Add to Chrome
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </button>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/50">Preferences</h2>
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-container">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              <span className="text-sm font-medium">Notifications</span>
            </div>
            <div className="w-10 h-6 bg-primary rounded-full relative flex items-center px-1">
              <div className="w-4 h-4 bg-white rounded-full ml-auto" />
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border-b border-surface-container">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">lock</span>
              <span className="text-sm font-medium">Privacy &amp; Security</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40">chevron_right</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">database</span>
              <span className="text-sm font-medium">Data Export</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40">chevron_right</span>
          </div>
        </div>
      </section>

      {/* Sign Out */}
      <section className="pt-4">
        <form action={async () => { "use server"; await signOut(); }}>
          <button type="submit" className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-error/20 text-error font-bold text-sm hover:bg-error/5 transition-colors">
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out
          </button>
        </form>
      </section>
    </div>
  );
}
