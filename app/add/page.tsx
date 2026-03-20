import { auth } from "@/auth";
import { getCollections } from "@/app/actions";
import { SignInPrompt } from "@/components/SignInPrompt";
import { AddBookmarkForm } from "@/components/AddBookmarkForm";

export const dynamic = "force-dynamic";

export default async function AddPage({ searchParams }: { searchParams: Promise<{ collection?: string; mode?: string }> }) {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  const sp = await searchParams;
  const collections = await getCollections();
  const preselectedCollection = sp.collection ? parseInt(sp.collection, 10) : undefined;
  const isCollectionMode = sp.mode === "collection";

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <AddBookmarkForm
        collections={collections}
        preselectedCollection={preselectedCollection}
        isCollectionMode={isCollectionMode}
      />
    </div>
  );
}
