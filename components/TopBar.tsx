import { auth, signIn } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { Settings, User } from "lucide-react";

export async function TopBar() {
  const session = await auth();

  return (
    <header className="fixed top-0 w-full z-50 h-14 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-6 md:px-10">
        <Link href="/" className="text-base font-bold tracking-tight font-mono">
          Recall
        </Link>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link href="/settings" className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
                <Settings className="w-[18px] h-[18px]" />
              </Link>
              <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {session.user.image ? (
                  <Image src={session.user.image} alt="" width={28} height={28} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <form action={async () => { "use server"; await signIn("google"); }}>
              <button type="submit" className="px-4 py-1.5 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-md">
                Sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
