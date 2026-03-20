import { auth, signIn, signOut } from "@/auth";
import Image from "next/image";

export async function TopBar() {
  const session = await auth();

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0px_4px_20px_rgba(27,27,35,0.04)]">
      <div className="flex justify-between items-center px-6 h-16 w-full">
        <div className="flex items-center gap-8">
          <span className="text-xl font-extrabold text-on-surface tracking-tighter">
            Recall
          </span>
          <nav className="hidden md:flex gap-6 items-center">
            <a href="/" className="text-sm font-bold uppercase tracking-wider text-primary border-b-2 border-primary pb-1">
              Dashboard
            </a>
            <a href="/collections" className="text-sm font-bold uppercase tracking-wider text-on-surface/60 hover:text-primary transition-colors">
              Collections
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline scale-75">
              search
            </span>
            <input
              type="text"
              placeholder="Quick Search..."
              className="bg-surface-container-high border-none rounded-lg py-2 pl-10 pr-4 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button className="md:hidden p-2 text-on-surface-variant">
            <span className="material-symbols-outlined">search</span>
          </button>
          {session?.user ? (
            <div className="flex items-center gap-2">
              <a href="/add" className="p-2 text-on-surface-variant hover:text-primary transition-all">
                <span className="material-symbols-outlined">add_circle</span>
              </a>
              <a href="/settings" className="hidden md:block p-2 text-on-surface-variant hover:text-primary transition-all">
                <span className="material-symbols-outlined">settings</span>
              </a>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30 ml-2">
                {session.user.image ? (
                  <Image src={session.user.image} alt="Avatar" width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold">
                    {session.user.name?.[0] ?? "?"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form action={async () => { "use server"; await signIn("google"); }}>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-md">
                Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
