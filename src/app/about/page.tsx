import Link from "next/link";
import { PublicPage } from "@/components/marketing/public-page";
import { ButtonLink } from "@/components/ui/button";
import { publicMetadata } from "@/lib/seo/public-metadata";

const DESCRIPTION =
  "SplitFairway is a private-beta app for golf scores, side games, weekly groups, and trip expenses. It does not book travel or hold money.";

export const metadata = publicMetadata("About", DESCRIPTION, "/about");

export default function AboutPage() {
  return (
    <PublicPage>
      <h1 className="text-3xl sm:text-4xl">About SplitFairway</h1>
      <p className="mt-4 text-lg leading-relaxed text-charcoal-500">
        SplitFairway is a private beta for the person who usually ends up keeping the group&apos;s
        scores and the trip spreadsheet.
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-charcoal-700">
        <p>
          You can score a round, run the side games your group already plays, keep a weekly
          group&apos;s roster and standings, and track who owes what on a golf trip. Invited
          golfers can join and see their own scores and balances without paying.
        </p>
        <p>
          It does not book tee times, rooms, or cars. It does not hold or send money. Payments
          your group already makes — Venmo, Zelle, cash, or anything else — stay outside the
          app. SplitFairway only records them, and a payment counts once the right person
          confirms it.
        </p>
        <p>
          The product is still in private beta. Paid plans are shown so you can see what
          organizing a group or a trip will cost later. During beta those features are unlocked
          for signed-in golfers. The legal pages are drafts and say so on the page.
        </p>
        <p>
          Questions go to the{" "}
          <Link href="/contact" className="font-medium text-forest-800 underline">
            contact page
          </Link>
          . If a support inbox is configured for this deployment, that address is listed there.
        </p>
      </div>
      <div className="mt-8">
        <ButtonLink href="/signup" variant="gold">
          Start playing free
        </ButtonLink>
      </div>
    </PublicPage>
  );
}
