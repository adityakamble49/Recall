import { auth } from "@/auth";
import { getAllBookmarks, getCollectionsWithCount, getDeletedCollections } from "./actions";
import { SignInPrompt } from "@/components/SignInPrompt";
import { DashboardContent } from "@/components/DashboardContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  const [allBookmarks, collections, deletedCollections] = await Promise.all([
    getAllBookmarks(),
    getCollectionsWithCount(),
    getDeletedCollections(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 md:py-16">
      <DashboardContent collections={collections} allBookmarks={allBookmarks} deletedCollections={deletedCollections} />
    </div>
  );
}
