import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { SupportEmail } from "@/components/ui/support-email";

export const metadata: Metadata = {
  // The root layout's title template already appends " · SplitFairway" —
  // setting the suffix here too would double it up in the rendered
  // <title> (confirmed: it did, in production, before this fix).
  title: "Privacy Policy",
  description:
    "Learn how SplitFairway collects, uses, shares, protects, and deletes personal information.",
  alternates: { canonical: "https://www.splitfairwaygolf.com/legal/privacy" },
};

const TOC = [
  { id: "information-we-collect", label: "1. Information We Collect" },
  { id: "trip-and-payment-information", label: "2. Trip and Payment Information" },
  { id: "how-we-use-information", label: "3. How We Use Information" },
  { id: "information-visible-to-other-trip-members", label: "4. Information Visible to Other Trip Members" },
  { id: "cookies-and-local-storage", label: "5. Cookies and Local Storage" },
  { id: "how-we-disclose-information", label: "6. How We Disclose Information" },
  { id: "no-sale-or-targeted-advertising", label: "7. No Sale or Targeted Advertising" },
  { id: "data-retention", label: "8. Data Retention" },
  { id: "account-and-data-deletion", label: "9. Account and Data Deletion" },
  { id: "your-privacy-choices-and-rights", label: "10. Your Privacy Choices and Rights" },
  { id: "data-security", label: "11. Data Security" },
  { id: "childrens-privacy", label: "12. Children's Privacy" },
  { id: "united-states-operation", label: "13. United States Operation" },
  { id: "third-party-services", label: "14. Third-Party Services" },
  { id: "changes-to-this-privacy-policy", label: "15. Changes to This Privacy Policy" },
  { id: "contact-us", label: "16. Contact Us" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="September 2, 2026" showDraftBanner={false}>
      <p>
        <strong>Effective Date:</strong> September 2, 2026
      </p>

      <p>
        SplitFairway (&ldquo;SplitFairway,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) provides software that helps golf-trip organizers and participants
        organize shared trip expenses, calculate balances, and track payments made outside the
        application.
      </p>
      <p className="mt-2">
        This Privacy Policy explains how we collect, use, disclose, retain, and protect
        information when you use the SplitFairway website, mobile web application, future iOS or
        Android applications, and related services collectively referred to as the
        &ldquo;Service.&rdquo;
      </p>
      <p className="mt-2">
        By using the Service, you acknowledge the practices described in this Privacy Policy.
      </p>

      <nav aria-label="Table of contents" className="rounded-lg bg-cream-100 p-4 text-sm">
        <p className="font-serif text-base text-forest-900">On this page</p>
        <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {TOC.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-forest-800 underline">
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="information-we-collect" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">1. Information We Collect</h2>

        <h3 className="mt-4 font-serif text-base text-forest-900">Information you provide</h3>
        <p className="mt-2">We may collect information that you submit when using SplitFairway, including:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Your name and email address</li>
          <li>Your password or other authentication information</li>
          <li>Account settings and preferences</li>
          <li>Trip names, dates, destinations, and notes</li>
          <li>Names and email addresses of golfers invited to a trip</li>
          <li>Expense descriptions, categories, amounts, and allocations</li>
          <li>Information about which golfers participated in an expense</li>
          <li>Reported payment amounts, payment methods, dates, statuses, and notes</li>
          <li>Invitations and reminder instructions</li>
          <li>Messages sent to customer support</li>
          <li>Feedback, bug reports, and feature requests</li>
          <li>Receipts or other files if file-upload functionality is offered</li>
        </ul>
        <p className="mt-2">
          Please avoid placing sensitive personal information in trip names, expense descriptions,
          feedback, or notes.
        </p>

        <h3 className="mt-4 font-serif text-base text-forest-900">Information collected automatically</h3>
        <p className="mt-2">
          When you use SplitFairway, we and the service providers that support the application may
          automatically receive limited technical information, such as:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Internet Protocol address</li>
          <li>Browser type</li>
          <li>Device type</li>
          <li>Operating system</li>
          <li>Requested pages</li>
          <li>Request dates and times</li>
          <li>Authentication and security events</li>
          <li>Error and diagnostic information</li>
          <li>Essential cookies, authentication tokens, and local-storage information</li>
        </ul>
        <p className="mt-2">
          We use this information to operate, secure, troubleshoot, and maintain the Service.
        </p>
        <p className="mt-2">
          SplitFairway does not currently use personal information for advertising, targeted
          advertising, cross-site tracking, or behavioral profiling.
        </p>
      </section>

      <section id="trip-and-payment-information" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">2. Trip and Payment Information</h2>
        <p className="mt-2">
          SplitFairway is an expense-calculation and payment-tracking service. It does not hold,
          transfer, or process money between users.
        </p>
        <p className="mt-2">
          Payments recorded in SplitFairway occur through services or methods chosen by users,
          such as Venmo, Zelle, PayPal, cash, or check. SplitFairway does not collect payment-card
          numbers, bank-account numbers, or login credentials for those services.
        </p>
        <p className="mt-2">
          A payment record in SplitFairway reflects information reported or confirmed by users.
          SplitFairway does not independently verify that an external payment occurred.
        </p>
      </section>

      <section id="how-we-use-information" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">3. How We Use Information</h2>
        <p className="mt-2">We may use information to:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Create and authenticate accounts</li>
          <li>Provide and maintain the Service</li>
          <li>Create and manage trips</li>
          <li>Calculate expenses and balances</li>
          <li>Display payment and settlement information</li>
          <li>Process trip invitations</li>
          <li>Send service-related emails and requested reminders</li>
          <li>Provide customer support</li>
          <li>Respond to feedback</li>
          <li>Investigate errors and technical problems</li>
          <li>Detect and prevent fraud, abuse, and unauthorized access</li>
          <li>Protect SplitFairway, our users, and others</li>
          <li>Enforce our Terms of Service</li>
          <li>Comply with legal obligations</li>
          <li>Improve the reliability and usability of the Service</li>
        </ul>
        <p className="mt-2">We do not use trip information or payment records to provide advertising.</p>
      </section>

      <section id="information-visible-to-other-trip-members" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">4. Information Visible to Other Trip Members</h2>
        <p className="mt-2">
          SplitFairway is designed for shared golf trips. Information entered for a trip may be
          visible to the trip captain, co-treasurers, and other invited participants as necessary
          to operate the shared ledger.
        </p>
        <p className="mt-2">
          Depending on a participant&apos;s role and the trip configuration, shared information
          may include:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Participant names</li>
          <li>Trip details</li>
          <li>Expense descriptions and amounts</li>
          <li>Expense allocations</li>
          <li>Amounts owed</li>
          <li>Reported payments</li>
          <li>Payment confirmation status</li>
          <li>Trip-related activity</li>
        </ul>
        <p className="mt-2">
          Only invite people you trust to a trip. Do not enter information that is unrelated to
          organizing or settling the trip.
        </p>
      </section>

      <section id="cookies-and-local-storage" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">5. Cookies and Local Storage</h2>
        <p className="mt-2">SplitFairway uses essential cookies, authentication tokens, and browser storage to:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Keep users signed in</li>
          <li>Maintain account security</li>
          <li>Remember necessary preferences</li>
          <li>Support installed-app functionality</li>
          <li>Operate core features</li>
        </ul>
        <p className="mt-2">
          Blocking essential cookies or storage may prevent account login or other parts of the
          Service from functioning correctly.
        </p>
        <p className="mt-2">
          SplitFairway does not currently use advertising cookies or cross-site tracking
          technologies.
        </p>
      </section>

      <section id="how-we-disclose-information" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">6. How We Disclose Information</h2>
        <p className="mt-2">We may disclose information in the following circumstances.</p>

        <p className="mt-3">
          <strong>Other trip participants:</strong> We disclose trip-related information to
          authorized members of the same trip as necessary to provide expense calculations,
          balances, and payment records.
        </p>

        <p className="mt-3">
          <strong>Service providers:</strong> We use third-party providers to operate the Service.
          These providers may process information on our behalf for purposes such as:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Authentication and database hosting</li>
          <li>Website and application hosting</li>
          <li>Transactional email delivery</li>
          <li>Security and error monitoring</li>
          <li>Customer-support and feedback delivery</li>
        </ul>
        <p className="mt-2">
          SplitFairway currently uses Supabase for authentication and database services. Other
          providers may be used to host the application or deliver service-related communications.
        </p>
        <p className="mt-2">
          These providers may access information only as necessary to provide their services to
          SplitFairway and are subject to their applicable contractual and legal obligations.
        </p>

        <p className="mt-3">
          <strong>Legal and safety reasons:</strong> We may disclose information when reasonably
          necessary to:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Comply with a law, regulation, legal process, or valid government request</li>
          <li>Enforce our agreements and policies</li>
          <li>Investigate fraud, abuse, or security incidents</li>
          <li>Protect the rights, safety, and property of SplitFairway, our users, or others</li>
        </ul>

        <p className="mt-3">
          <strong>Business transactions:</strong> If SplitFairway is involved in a merger,
          acquisition, financing, reorganization, sale of assets, or similar business transaction,
          information may be transferred as part of that transaction. Any successor will remain
          subject to this Privacy Policy or provide notice of materially different practices.
        </p>

        <p className="mt-3">
          <strong>At your direction:</strong> We may disclose information when you direct us to do
          so or provide consent.
        </p>
      </section>

      <section id="no-sale-or-targeted-advertising" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">7. No Sale or Targeted Advertising</h2>
        <p className="mt-2">SplitFairway does not:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Sell personal information</li>
          <li>Share personal information for cross-context behavioral advertising</li>
          <li>Use personal information for targeted advertising</li>
          <li>Operate as a data broker</li>
        </ul>
        <p className="mt-2">
          If these practices change, we will update this Privacy Policy and provide any legally
          required choices before beginning the new activity.
        </p>
      </section>

      <section id="data-retention" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">8. Data Retention</h2>
        <p className="mt-2">
          We retain account and trip information while an account remains active and for as long
          as reasonably necessary to provide the Service.
        </p>
        <p className="mt-2">We may retain limited information for longer when reasonably necessary to:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Maintain security records</li>
          <li>Prevent fraud or abuse</li>
          <li>Resolve disputes</li>
          <li>Enforce agreements</li>
          <li>Meet legal obligations</li>
          <li>Maintain accurate records for other members of a shared trip</li>
        </ul>
        <p className="mt-2">
          Deleted information may remain temporarily in protected backups until those backups are
          overwritten through our normal backup cycle. We do not use backup copies for ordinary
          business purposes after a deletion request has been completed.
        </p>
      </section>

      <section id="account-and-data-deletion" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">9. Account and Data Deletion</h2>
        <p className="mt-2">
          You may initiate deletion of your account through the{" "}
          <a href="/account" className="text-forest-800 underline">
            Account Settings
          </a>{" "}
          section of SplitFairway.
        </p>
        <p className="mt-2">Account deletion may include:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Deleting your authentication identity and user profile</li>
          <li>Ending active sessions</li>
          <li>Deleting trips where you are the only active participant</li>
          <li>Removing or expiring unused invitations</li>
          <li>Deleting associated feedback records where applicable</li>
          <li>Disconnecting your identity from shared trips</li>
        </ul>
        <p className="mt-2">Deleting your account will not delete another person&apos;s information.</p>
        <p className="mt-2">
          When deleting your information from a trip shared with other golfers, SplitFairway may
          preserve limited expense and payment records in anonymized form when necessary to keep
          the remaining participants&apos; balances and ledgers accurate. Your identifying profile
          information will be removed or replaced with a generic label.
        </p>
        <p className="mt-2">
          If you are the only captain of a shared trip, another eligible participant may be
          assigned as captain so the trip is not left without someone able to manage it.
        </p>
        <p className="mt-2">
          If you cannot access your account, you may request assistance by emailing{" "}
          <SupportEmail /> from the email address associated with your account.
        </p>
        <p className="mt-2">
          Additional information is available at:{" "}
          <a href="/legal/data-deletion" className="text-forest-800 underline">
            https://www.splitfairwaygolf.com/legal/data-deletion
          </a>
        </p>
        <p className="mt-2">
          We may retain information that we are legally required to keep or that is reasonably
          necessary for security, fraud prevention, or dispute resolution.
        </p>
      </section>

      <section id="your-privacy-choices-and-rights" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">10. Your Privacy Choices and Rights</h2>
        <p className="mt-2">
          Depending on where you live and subject to applicable law, you may have the right to:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Request access to personal information we maintain about you</li>
          <li>Correct inaccurate personal information</li>
          <li>Delete personal information</li>
          <li>Request a portable copy of certain information</li>
          <li>Obtain information about how personal information is collected, used, or disclosed</li>
          <li>Withdraw consent where processing depends on consent</li>
          <li>Appeal the denial of an applicable privacy request</li>
          <li>Opt out of certain data practices if SplitFairway adopts them in the future</li>
        </ul>
        <p className="mt-2">
          You may exercise available account controls through SplitFairway or contact us at{" "}
          <SupportEmail />.
        </p>
        <p className="mt-2">
          We may need to verify your identity before completing a request. We will not
          discriminate against you for exercising an applicable privacy right.
        </p>
        <p className="mt-2">
          Some information may be exempt from a request when retention or processing is permitted
          or required by law.
        </p>
      </section>

      <section id="data-security" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">11. Data Security</h2>
        <p className="mt-2">
          We use reasonable administrative, technical, and organizational safeguards designed to
          protect information.
        </p>
        <p className="mt-2">Depending on the applicable system, these measures may include:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Encrypted HTTPS connections</li>
          <li>Supabase authentication</li>
          <li>Database access controls</li>
          <li>Row-level database security</li>
          <li>Restricted administrative access</li>
          <li>Server-side authorization for privileged actions</li>
          <li>Security logging and monitoring</li>
        </ul>
        <p className="mt-2">
          No internet service or storage system can be guaranteed to be completely secure. You are
          responsible for protecting your password and should notify us if you believe your
          account has been accessed without authorization.
        </p>
      </section>

      <section id="childrens-privacy" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">12. Children&apos;s Privacy</h2>
        <p className="mt-2">
          SplitFairway is intended for users who are at least 18 years old. The Service is not
          directed to children under 13, and we do not knowingly collect personal information from
          children.
        </p>
        <p className="mt-2">
          If you believe a child has submitted personal information to SplitFairway, contact{" "}
          <SupportEmail /> so we can investigate and take appropriate action.
        </p>
      </section>

      <section id="united-states-operation" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">13. United States Operation</h2>
        <p className="mt-2">
          SplitFairway is operated from the United States. Information may be stored or processed
          in the United States and in other locations where our service providers operate.
        </p>
        <p className="mt-2">
          If you access SplitFairway from outside the United States, you understand that
          applicable privacy protections may differ from those in your jurisdiction.
        </p>
        <p className="mt-2">
          SplitFairway is currently intended for adult users in the United States. We do not
          represent that the Service has been configured to satisfy every privacy requirement
          outside the United States.
        </p>
      </section>

      <section id="third-party-services" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">14. Third-Party Services</h2>
        <p className="mt-2">
          The Service may contain links to third-party services such as payment applications, golf
          courses, lodging providers, or travel vendors.
        </p>
        <p className="mt-2">
          SplitFairway does not control and is not responsible for the privacy practices of third
          parties. Information submitted directly to a third party is governed by that third
          party&apos;s privacy policy.
        </p>
      </section>

      <section id="changes-to-this-privacy-policy" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">15. Changes to This Privacy Policy</h2>
        <p className="mt-2">We may update this Privacy Policy as the Service changes.</p>
        <p className="mt-2">
          If we make material changes, we may provide notice through the Service, on our website,
          or by email when appropriate. The Effective Date at the top of the policy indicates when
          it was most recently updated.
        </p>
        <p className="mt-2">
          Your continued use of the Service after an updated policy becomes effective is subject to
          the updated policy.
        </p>
      </section>

      <section id="contact-us" className="scroll-mt-24">
        <h2 className="font-serif text-lg text-forest-900">16. Contact Us</h2>
        <p className="mt-2">Questions or requests regarding this Privacy Policy may be sent to:</p>
        <p className="mt-2">
          SplitFairway
          <br />
          Email: <SupportEmail />
          <br />
          Website:{" "}
          <a href="https://www.splitfairwaygolf.com" className="text-forest-800 underline">
            https://www.splitfairwaygolf.com
          </a>
        </p>
      </section>
    </LegalPageShell>
  );
}
