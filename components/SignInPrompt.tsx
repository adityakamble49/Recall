import { signIn } from "@/auth";
import { Bookmark } from "lucide-react";

export function SignInPrompt() {
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-32 flex flex-col items-center text-center">
      <Bookmark className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-6" />
      <h1 className="text-3xl font-bold tracking-tight mb-2">Recall</h1>
      <p className="text-zinc-500 mb-8 max-w-xs">
        Save, organize, and open bookmarks as Chrome tab groups.
      </p>
      <form action={async () => { "use server"; await signIn("google"); }}>
        <button type="submit" className="px-6 py-2.5 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
