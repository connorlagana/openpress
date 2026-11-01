import type { Metadata } from "next";
import { PageIntro, PublicShell } from "@/components/app/brand";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy policy" };

const CONTACT_EMAIL = "connor.lagana@gmail.com";
const EFFECTIVE = "October 18, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="op-h2">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:mt-1.5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const name = config.appName;
  return (
    <PublicShell>
      <main className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <PageIntro kicker={`Effective ${EFFECTIVE}`} title="Privacy policy" />
        <p className="mt-8 text-[15px] leading-relaxed">
          {name} ({config.rootDomain}) hosts websites that you publish yourself or through an AI agent you connect. This policy explains what we collect, why, and what you can do about it. We
          don&rsquo;t sell personal information and we don&rsquo;t show ads.
        </p>

        <Section title="What we collect">
          <ul>
            <li>
              <strong>Your account:</strong> your email address, your name if you give one, and either a securely hashed password or the account ID from Google or Apple if you sign in with
              them.
            </li>
            <li>
              <strong>From Google or Apple sign-in:</strong> only your name, email address and account ID. We don&rsquo;t ask for access to your contacts, files, calendar or anything else.
            </li>
            <li>
              <strong>What you publish:</strong> sites, posts, pages, images and settings, whether you create them yourself or your agent does.
            </li>
            <li>
              <strong>Agent connections:</strong> which apps you connect (for example Claude or ChatGPT), the permissions you grant, when each was last used, and hashed access tokens.
            </li>
            <li>
              <strong>Security records:</strong> the IP address and browser type of your signed-in sessions, and an activity log of publishing, deletions and permission changes.
            </li>
            <li>
              <strong>Abuse reports:</strong> the URL and details you report, and your email if you choose to include it.
            </li>
          </ul>
        </Section>

        <Section title="Visitors to sites we host">
          <p>
            Sites on {name} get simple, cookieless analytics: the page viewed, the referring site, and a coarse category of where the visit came from. To count unique visitors we keep a hash of
            the IP address and browser type, salted with a value that changes every day, so visits can&rsquo;t be linked across days and the IP address itself is never stored. Bot traffic is
            ignored. Analytics are kept for {config.analyticsRetentionDays} days.
          </p>
        </Section>

        <Section title="Cookies">
          <p>We use only the cookies the service needs, and none for advertising or cross-site tracking:</p>
          <ul>
            <li>a session cookie that keeps you signed in;</li>
            <li>a cookie remembering that this browser has signed in before, so we can show sign-in instead of sign-up;</li>
            <li>a 30-day cookie recording which site or campaign referred you, if any;</li>
            <li>a short-lived cookie (10 minutes) that secures Google or Apple sign-in while it&rsquo;s in progress.</li>
          </ul>
          <p>Sites hosted on {name} don&rsquo;t set cookies.</p>
        </Section>

        <Section title="How we use it">
          <ul>
            <li>to run your account and host the sites you publish;</li>
            <li>to let the agents you connect act within the permissions you gave them;</li>
            <li>to keep the service secure, prevent abuse and enforce limits;</li>
            <li>to understand, in aggregate, how people find and use {name}.</li>
          </ul>
          <p>We don&rsquo;t use your content or personal information to train AI models.</p>
        </Section>

        <Section title="Google user data">
          <p>
            {name}&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
            <a className="text-foreground underline underline-offset-4" href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We use it only to sign you in and identify your account, and never transfer it to others except as needed to run the service, to
            comply with the law, or as part of a merger or acquisition.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>We share data only with the providers that run {name} for us, and only as needed to do so:</p>
          <ul>
            <li>Railway (application hosting and media storage);</li>
            <li>Neon (database);</li>
            <li>Porkbun (domain name service);</li>
            <li>Google and Apple, only if you choose to sign in with them.</li>
          </ul>
          <p>
            AI agents you connect, like Claude or ChatGPT, receive the content they read or write through {name}. Their own privacy policies apply to what they do with it. We may also
            disclose information if the law requires it, or to protect people from harm.
          </p>
          <p>Whatever you publish on a public site is, of course, public.</p>
        </Section>

        <Section title="Retention and your choices">
          <ul>
            <li>We keep your account data for as long as your account exists.</li>
            <li>You can edit or delete your sites and posts, and revoke any agent connection, at any time from your dashboard.</li>
            <li>
              To get a copy of your data, correct it, or delete your account and everything in it, email us at{" "}
              <a className="text-foreground underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              . We&rsquo;ll respond within 30 days.
            </li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            Passwords are stored only as salted hashes, and access tokens only as hashes. Connections are encrypted, and the database enforces that each account can reach only its own data.
            No system is perfectly secure, but we work to protect yours.
          </p>
        </Section>

        <Section title="Children">
          <p>{name} isn&rsquo;t intended for children under 13, and we don&rsquo;t knowingly collect their personal information.</p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If we make significant changes we&rsquo;ll update the date above and, where appropriate, tell you by email. Questions? Email{" "}
            <a className="text-foreground underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </main>
    </PublicShell>
  );
}
