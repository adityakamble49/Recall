import { signIn } from "@/auth";

export function SignInPrompt() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-sm">
        <span className="material-symbols-outlined text-primary text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          bookmarks
        </span>
        <h1 className="text-4xl font-extrabold tracking-tighter">Recall</h1>
        <p className="text-on-surface-variant">
          Precision bookmark organization. Sign in to start curating your digital library.
        </p>
        <form action={async () => { "use server"; await signIn("google"); }}>
          <button type="submit" className="px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-xl active:scale-95 transition-all">
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
