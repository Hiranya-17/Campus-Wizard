import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy · CampusWizard" };

const REPO = "https://github.com/Hiranya-17/Campus-Wizard";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-lg font-semibold">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <article className="space-y-3 pb-8 text-sm leading-relaxed text-zinc-700">
      <h1 className="text-2xl font-bold text-zinc-900">Privacy Policy</h1>
      <p className="text-xs text-zinc-500">Effective October 24, 2026</p>
      <p>
        CampusWizard is a student project built for the DS+X and Hackachusetts 2026 hackathons to help Boston University students
        plan classes, their week, getting to class and their spending. It is not an official Boston University service.
        This policy explains what CampusWizard collects, why, and what you can do about it.
      </p>

      <H>What we collect</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Guest mode:</b> if you don&apos;t create an account, everything stays in your browser&apos;s local storage on your device. We don&apos;t receive it.</li>
        <li><b>Account details:</b> your name and email address, and a scrypt hash of your password if you sign up with email (we never store the password itself). If you sign in with Google we receive your name, email address and Google account ID.</li>
        <li><b>What you add to CampusWizard:</b> courses you&apos;ve taken, your class schedule, exams and homework you save from syllabi, club meetings, weekly preferences, where you live on campus, purchases and your budget.</li>
        <li><b>Files and text you choose to upload:</b> receipt photos, PDFs, syllabi, pasted emails and chat messages are processed to extract information (see below). We keep only the results you choose to save (for example a purchase or an exam date), not the original file or email.</li>
        <li><b>Spreadsheets</b> (CSV or Excel bank exports) are read on your device and are not uploaded.</li>
        <li><b>Technical data:</b> your IP address is used briefly to limit how many requests can be made (to prevent abuse); these counters expire within an hour.</li>
      </ul>

      <H>Google user data (Gmail and Google Calendar)</H>
      <p>
        Signing in with Google only shares your name and email address. Only if you tap <b>Connect Gmail &amp; Calendar</b> does CampusWizard ask for:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Gmail (read-only):</b> to read recent emails you choose to import, such as club newsletters and order confirmations, so CampusWizard can find meetings or purchases. CampusWizard never sends, deletes or changes email.</li>
        <li><b>Google Calendar:</b> to add the events in your week plan to your calendar when you ask it to.</li>
      </ul>
      <p>
        Access tokens for these permissions are stored on our server, tied to your account, and used only to provide these features
        when you request them. You can disconnect at any time from the Account page, which revokes CampusWizard&apos;s access at Google and
        deletes the stored tokens; you can also remove access at myaccount.google.com/permissions.
      </p>
      <p>
        CampusWizard&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a className="text-bu underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements. We do not use Google user data for advertising, we do not sell it, and we do not
        use it to train AI models.
      </p>

      <H>Who processes your data</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Vercel</b> hosts the app; account data is stored in a Redis database provided through Vercel.</li>
        <li><b>Google Gemini</b> (paid API) reads uploaded receipts, PDFs, syllabi and emails you submit, and powers the CampusWizard chat. Under Google&apos;s paid API terms, this content is not used to train Google&apos;s models.</li>
        <li><b>MBTA and the National Weather Service</b> provide transit times and forecasts; we send them no personal data.</li>
      </ul>
      <p>We don&apos;t sell your data, show ads, or share it with anyone else.</p>

      <H>Keeping and deleting your data</H>
      <p>
        Your data is kept while your account exists. You can edit or remove courses, classes, exams and purchases in the app, and
        disconnect Google from the Account page. To delete your account and all its data, open an issue on our{" "}
        <a className="text-bu underline" href={`${REPO}/issues`} target="_blank" rel="noreferrer">GitHub repository</a> titled
        &ldquo;Delete my account&rdquo; with your account email (no other details needed), and we&apos;ll delete it.
      </p>

      <H>Security</H>
      <p>
        Passwords are hashed, sessions use signed httpOnly cookies, connections use HTTPS, and requests are rate-limited. No system
        is perfectly secure, so please don&apos;t store information in CampusWizard you couldn&apos;t afford to lose.
      </p>

      <H>Changes and contact</H>
      <p>
        We&apos;ll update this page if our practices change. Questions: open an issue on our{" "}
        <a className="text-bu underline" href={`${REPO}/issues`} target="_blank" rel="noreferrer">GitHub repository</a>.
      </p>
      <p className="pt-4 text-xs text-zinc-500"><Link href="/terms" className="underline">Terms of Service</Link> · <Link href="/" className="underline">Back to CampusWizard</Link></p>
    </article>
  );
}
