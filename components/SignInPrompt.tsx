import { signIn } from "@/auth";
import { Bookmark } from "lucide-react";

export function SignInPrompt() {
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-32 flex flex-col items-center text-center">
      <Bookmark className="w-12 h-12 text-muted/20 mb-6" />
      <h1 className="text-3xl font-bold tracking-tight mb-2 text-primary">Recall</h1>
      <p className="text-secondary mb-8 max-w-xs text-base">
        Save, organize, and open bookmarks as Chrome tab groups.
      </p>
      <form action={async () => { "use server"; await signIn("google"); }}>
        <button type="submit" className="px-6 py-2.5 text-sm font-medium bg-primary text-void rounded-xl hover:opacity-90 transition-opacity">
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
