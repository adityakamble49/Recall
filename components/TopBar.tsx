import { auth, signIn } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { Settings, User } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export async function TopBar() {
  const session = await auth();

  return (
    <header className="fixed top-0 w-full z-50 h-14 bg-nav-bg backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
        <Link href="/" className="text-base font-bold tracking-tight font-mono text-primary flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          Recall
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {session?.user ? (
            <>
              <Link href="/settings" className="p-2 text-secondary hover:text-primary transition-colors">
                <Settings className="w-[18px] h-[18px]" />
              </Link>
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-border">
                {session.user.image ? (
                  <Image src={session.user.image} alt="" width={28} height={28} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-raised flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-secondary" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <form action={async () => { "use server"; await signIn("google"); }}>
              <button type="submit" className="px-4 py-1.5 text-sm font-medium bg-primary text-void rounded-md hover:opacity-90 transition-opacity">
                Sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
