import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service · Rhett" };

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-lg font-semibold">{children}</h2>;
}

export default function TermsPage() {
  return (
    <article className="space-y-3 pb-8 text-sm leading-relaxed text-zinc-700">
      <h1 className="text-2xl font-bold text-zinc-900">Terms of Service</h1>
      <p className="text-xs text-zinc-500">Effective October 24, 2026</p>
      <p>
        By using Rhett you agree to these terms. Rhett is a free student project built for the DS+X and Hackachusetts 2026
        hackathons. It is <b>not affiliated with, endorsed by or operated by Boston University</b>, the MBTA, or any delivery app.
      </p>

      <H>Use it as a helper, not an authority</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Courses and registration:</b> course, section, prerequisite and major information comes from BU&apos;s public web pages and may be incomplete or out of date. Always confirm with your academic advisor and the official BU registration system before registering. Rhett does not register you for anything.</li>
        <li><b>AI features:</b> Rhett&apos;s chat and the reading of syllabi, receipts and emails use AI and can make mistakes. Check exam dates against your syllabus and course site, and purchases against your statements.</li>
        <li><b>Transit, weather and dining:</b> train times, forecasts and leave-by times are estimates. Dining hall menus shown are samples, not the real daily menu.</li>
        <li><b>Prices and budget:</b> delivery prices were collected at a point in time and change constantly. Budget figures are estimates, not financial advice.</li>
      </ul>

      <H>Your account and content</H>
      <p>
        Keep your login secure and give accurate information. You own what you add to Rhett. You give us permission to store and
        process it only to run the app for you, as described in the <Link href="/privacy" className="text-bu underline">Privacy Policy</Link>.
      </p>

      <H>Acceptable use</H>
      <p>
        Don&apos;t misuse Rhett: no attempts to access other people&apos;s data, overload or attack the service, scrape it at
        volume, or upload content you don&apos;t have the right to share. We may limit or remove access that breaks these rules.
      </p>

      <H>No warranty</H>
      <p>
        Rhett is provided &ldquo;as is&rdquo;, without warranties of any kind, and may change or stop at any time. To the extent the
        law allows, the project team is not liable for missed classes, exams, deadlines, registration problems, charges or any
        other loss from using it.
      </p>

      <H>Changes</H>
      <p>We may update these terms; the effective date above will change when we do.</p>
      <p className="pt-4 text-xs text-zinc-500"><Link href="/privacy" className="underline">Privacy Policy</Link> · <Link href="/" className="underline">Back to Rhett</Link></p>
    </article>
  );
}
