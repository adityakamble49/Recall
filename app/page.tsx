import { auth } from "@/auth";
import { getAllBookmarks, getCollectionsWithCount, getTotalBookmarkCount } from "./actions";
import { InstantCapture } from "@/components/InstantCapture";
import { SignInPrompt } from "@/components/SignInPrompt";
import { DashboardContent } from "@/components/DashboardContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  const [allBookmarks, collections, totalCount] = await Promise.all([
    getAllBookmarks(),
    getCollectionsWithCount(),
    getTotalBookmarkCount(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 md:py-16">
      <section className="mb-16">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2 font-mono">Dashboard</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
          <span className="font-mono">{totalCount}</span> <span className="text-zinc-300 dark:text-zinc-700">bookmarks</span>
        </h1>
        <InstantCapture />
      </section>

      <DashboardContent collections={collections} allBookmarks={allBookmarks} />
    </div>
  );
}
