import Link from "next/link";
import { PublicPage } from "@/components/marketing/public-page";
import { ButtonLink } from "@/components/ui/button";
import { publicMetadata } from "@/lib/seo/public-metadata";

const DESCRIPTION =
  "How Wolf, Nassau, skins, Vegas, quota, nines, and the other side games in SplitFairway are scored — the same rules the app uses.";

export const metadata = publicMetadata("Golf side games", DESCRIPTION, "/guides/golf-side-games");

const GAMES: { name: string; body: string }[] = [
  {
    name: "Nassau",
    body: "Two sides. On an 18-hole card there are three matches: the front nine, the back nine, and the full round. Each hole is won, lost, or halved. A side with more than one player counts its best score on the hole. The match can close early — if you are 3 up with 2 holes left, that is 3&2. A press is another match that starts on a later hole. You can try the rules on the Nassau calculator before you save a round.",
  },
  {
    name: "Skins",
    body: "The lowest score on a hole wins that skin, and it has to be the only lowest score. A tie wins nothing. With carryover on, the tied skin rolls into the next hole, so one win can be worth several skins. With carryover off, a tie is simply lost. Net skins use each player's playing handicap. The skins calculator uses these same rules.",
  },
  {
    name: "Match play",
    body: "Two golfers, or two teams, play the round hole by hole. Whoever wins the most holes wins the match. It is the same win / lose / halve idea as a single Nassau match, without the automatic front, back, and overall bets.",
  },
  {
    name: "Wolf",
    body: "Four players, in a fixed order. The wolf rotates each hole. After the others tee off, the wolf picks a partner for a 2-on-2 best ball, or goes alone against the other three. The better score on each side wins, loses, or halves the hole. When the game has a dollar value, going alone doubles that hole's bet.",
  },
  {
    name: "Vegas",
    body: "Two teams of two. Each team's scores on a hole are written as a two-digit number with the lower score first — a 4 and a 5 is 45, not 9. The lower team number wins the hole, and the gap between the numbers is the bet. A 10 or worse is still handled as “lower score times 10, plus the other score,” which stops being two clean digits. Some groups add a house rule for those holes; the app does not flip the digits.",
  },
  {
    name: "Stableford",
    body: "Points, not strokes. Against net score: double bogey or worse is 0, bogey is 1, par is 2, birdie is 3, eagle is 4. The higher total wins. That is the standard table the app uses: 2 minus how many strokes the net score was over par, and never below zero.",
  },
  {
    name: "Quota",
    body: "Each player has a personal target of 36 minus their playing handicap. Points are on gross score versus par, not net, so the handicap is not applied twice: eagle or better 8, birdie 4, par 2, bogey 1, double bogey or worse 0. You are trying to beat your own number.",
  },
  {
    name: "Nines",
    body: "Three players. Every hole splits exactly 9 points: 5 for the best score, 3 for the middle, 1 for the worst. Ties share the points for the places they tie across, so the hole still adds up to 9.",
  },
  {
    name: "Twos Club",
    body: "Card a 2, gross or net depending on the game, and you are in on that hole. There is no carryover. If more than one player makes a 2, they split that hole. Holes with no 2 pay nothing.",
  },
  {
    name: "Stroke play and best ball",
    body: "Stroke play compares total score, lower wins. Best ball counts only a side's best score on each hole and adds those up. Worst ball counts a side's highest score instead. A shamble uses the team's best drive, then each player finishes the hole and the side still posts a team score.",
  },
  {
    name: "Other formats",
    body: "The app also scores Lone Ranger, Cha Cha Cha, team average, one gross and one net, low ball / high ball, low ball / low total, and low handicap / high handicap. A custom game can be listed on the round when you are playing something it does not calculate. Everyone can see that it is in play; the app will not invent a result for it.",
  },
];

export default function GolfSideGamesPage() {
  return (
    <PublicPage>
      <h1 className="text-3xl sm:text-4xl">Golf side games, scored the way the app scores them</h1>
      <p className="mt-4 text-lg leading-relaxed text-charcoal-500">
        Wolf, Nassau, skins, and the rest of the formats SplitFairway can run from the scores you
        enter. House rules your group adds on top of these are yours to track.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
        Dollar amounts, when you turn them on, are a private record between the golfers.
        SplitFairway does not hold or move the money. Try a{" "}
        <Link href="/tools/nassau-calculator" className="font-medium text-forest-800 underline">
          Nassau
        </Link>{" "}
        or{" "}
        <Link href="/tools/skins-calculator" className="font-medium text-forest-800 underline">
          skins
        </Link>{" "}
        round here before you create an account.
      </p>

      <div className="mt-10 space-y-8">
        {GAMES.map((game) => (
          <section key={game.name}>
            <h2 className="text-xl text-forest-900">{game.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-700">{game.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10">
        <ButtonLink href="/signup" variant="gold" size="lg">
          Start playing free
        </ButtonLink>
      </div>
    </PublicPage>
  );
}
