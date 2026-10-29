import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Recall",
  description: "How Recall and the Recall Chrome extension collect, use, and protect your data.",
};

const CONTACT_EMAIL = "adityakamble49@gmail.com";
const EFFECTIVE_DATE = "October 28, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-secondary">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 md:px-10 py-10 md:py-16 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Privacy Policy</h1>
        <p className="text-xs text-muted font-mono">Effective {EFFECTIVE_DATE}</p>
        <p className="text-sm leading-relaxed text-secondary">
          This policy covers the Recall website at recall.ltd and the Recall Chrome extension. Recall is a
          personal bookmarking service: it saves the pages you choose so you can organize and reopen them later.
        </p>
      </header>

      <Section title="What we collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="text-primary font-medium">Account information.</span> When you sign in with Google,
            we receive your name, email address, and profile image. We do not receive your Google password.
          </li>
          <li>
            <span className="text-primary font-medium">Bookmarks and collections.</span> The page URLs and titles
            you save, the collections you create, and when you saved them.
          </li>
          <li>
            <span className="text-primary font-medium">Extension connection.</span> When you connect the Chrome
            extension, we issue it an access credential. The extension stores that credential on your device; we
            store only a one-way hash of it, plus when it was created and when it expires.
          </li>
        </ul>
      </Section>

      <Section title="What the extension accesses">
        <p>
          The extension reads tab URLs and titles only when you act in its popup: saving the current tab, saving
          a tab group as a collection, or reopening a collection as tabs. It does not read page contents, track
          your browsing history, or run on the websites you visit. It communicates only with recall.ltd.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          We use your data only to provide Recall: signing you in, storing your bookmarks, and showing them back
          to you. We do not sell your data, use it for advertising, or share it with anyone for their own purposes.
        </p>
      </Section>

      <Section title="Service providers">
        <ul className="list-disc pl-5 space-y-2">
          <li>Google, for sign-in.</li>
          <li>Vercel, which hosts the website and API.</li>
          <li>Neon, which hosts the database.</li>
        </ul>
        <p>
          To show site icons, Recall loads favicons from Google&apos;s favicon service, which receives the domain of
          each saved bookmark. To fill in missing page titles, Recall&apos;s server may request the page you saved.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          Your data is kept until you delete it. Deleting a bookmark or permanently deleting a collection removes
          it immediately. You can disconnect the extension from Settings at any time. To delete your account and
          all associated data, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="Security">
        <p>
          All traffic is encrypted with HTTPS. Extension credentials are stored only as hashes on our servers and
          expire after 90 days.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, we will update it here and change the effective date. Questions:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </div>
  );
}
