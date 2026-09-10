import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export interface ActiveSkinsGameSummary {
  kind: "skins";
  id: string;
  name: string;
  /** Already sorted best-to-worst with tie-aware rank assigned (equal skinsWon => equal rank). */
  standings: { roundPlayerId: string; displayName: string; skinsWon: number; rank: number }[];
  skinsAwarded: number;
  /** Skins currently riding on an unresolved tie, pending the next hole. 0 when nothing is carrying. */
  skinsCarriedOver: number;
  holesRemaining: number;
}

export interface ActiveOtherGameSummary {
  kind: "other";
  id: string;
  name: string;
  gameTypeLabel: string;
}

export type ActiveGameSummary = ActiveSkinsGameSummary | ActiveOtherGameSummary;

/**
 * The Games screen's "what's already in play" view (see games/page.tsx).
 * Deliberately money-free -- ante amounts and running dollar balances
 * stay on the Game Details and Settle Up screens, so this only ever
 * shows skins counts, carryovers and holes remaining. Every number
 * here is derived straight from the same computeSkins() the Game
 * Details page uses; nothing about the underlying game math changes.
 */
export function ActiveGamesSummary({
  tripId,
  roundId,
  isCaptain,
  games,
}: {
  tripId: string;
  roundId: string;
  isCaptain: boolean;
  games: ActiveGameSummary[];
}) {
  if (games.length === 0) return null;

  const detailsHref = `/trips/${tripId}/rounds/${roundId}/games/details`;

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-xl text-forest-900">Active Games</h2>

      <div className="space-y-4">
        {games.map((game) => (
          <Card key={game.id}>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-medium text-charcoal-800">{game.name}</p>
                <Badge variant="success" className="px-3 py-1.5 text-base">
                  In Progress
                </Badge>
              </div>

              {game.kind === "skins" ? (
                <>
                  {game.standings.length === 0 ? (
                    <p className="text-base text-charcoal-400">No skins won yet.</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {game.standings.map((s) => (
                        <li
                          key={s.roundPlayerId}
                          className="flex items-center justify-between text-base text-charcoal-700"
                        >
                          <span>
                            {s.rank}. {s.displayName}
                          </span>
                          <span>
                            {s.skinsWon} skin{s.skinsWon === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="space-y-1 text-base text-charcoal-500">
                    <p>
                      {game.skinsAwarded} skin{game.skinsAwarded === 1 ? "" : "s"} awarded
                    </p>
                    {game.skinsCarriedOver > 0 && (
                      <p>
                        {game.skinsCarriedOver} skin{game.skinsCarriedOver === 1 ? "" : "s"} carried over
                      </p>
                    )}
                    <p>
                      {game.holesRemaining} hole{game.holesRemaining === 1 ? "" : "s"} remaining
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-base text-charcoal-500">
                  {game.gameTypeLabel} — see game details for full standings.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <ButtonLink href={detailsHref} size="lg">
                  {game.kind === "skins" ? "View Skins Details" : "View Game Details"}
                </ButtonLink>
                {isCaptain && (
                  <ButtonLink href={detailsHref} variant="outline" size="lg">
                    Edit Game
                  </ButtonLink>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
