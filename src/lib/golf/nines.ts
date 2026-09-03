import { strokesReceivedByHole, type PlayerScoreInput } from "@/lib/golf/scoring";
import { netScore } from "@/lib/golf/handicap";

/**
 * Nines scoring (phase 9 follow-up, aka Hollywood): a 3-player points
 * game where every hole splits a fixed 9 points -- 5 for the best
 * score, 3 for the middle, 1 for the worst. Ties share the points for
 * the ranks they tie across (e.g. two tied for best split 5+3=8 down
 * the middle, 4 each, and the third player still gets the 1; all three
 * tied splits 9 three ways, 3 each) -- so every hole's points always
 * sum to exactly 9 regardless of ties, which is what makes the money
 * settlement (settlement.ts#computeNinesSettlement) a clean zero-sum
 * comparison against the 3-point-per-hole average.
 */

const POINTS_BY_RANK = [5, 3, 1];

function valueOnHole(player: PlayerScoreInput, holeNumber: number, metric: "gross" | "net"): number | null {
  const g = player.grossByHole.get(holeNumber);
  if (g == null) return null;
  if (metric === "gross") return g;
  return netScore(g, strokesReceivedByHole(player.playingHandicap, player.holes).get(holeNumber) ?? null) ?? g;
}

export interface NinesHoleResult {
  holeNumber: number;
  /** Exactly 3 entries once decided, summing to 9. */
  pointsByPlayer: Map<string, number>;
}

export interface NinesResult {
  holes: NinesHoleResult[];
  totalsByPlayer: Map<string, number>;
}

/** players must have exactly 3 entries -- enforced by the create form/action, not here. Stops at the first hole missing a score, same convention as nassau/skins. */
export function computeNines(
  players: PlayerScoreInput[],
  holeNumbers: number[],
  metric: "gross" | "net",
): NinesResult {
  const totalsByPlayer = new Map<string, number>(players.map((p) => [p.roundPlayerId, 0]));
  const holes: NinesHoleResult[] = [];

  for (const holeNumber of holeNumbers) {
    const values = players.map((p) => ({ id: p.roundPlayerId, value: valueOnHole(p, holeNumber, metric) }));
    if (values.some((v) => v.value == null)) break;

    const sorted = [...values].sort((a, b) => a.value! - b.value!);
    const groups: { value: number; ids: string[] }[] = [];
    for (const v of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.value === v.value) last.ids.push(v.id);
      else groups.push({ value: v.value!, ids: [v.id] });
    }

    const pointsByPlayer = new Map<string, number>();
    let rankCursor = 0;
    for (const group of groups) {
      const pointsForGroup = POINTS_BY_RANK.slice(rankCursor, rankCursor + group.ids.length).reduce((a, b) => a + b, 0);
      const share = pointsForGroup / group.ids.length;
      for (const id of group.ids) pointsByPlayer.set(id, share);
      rankCursor += group.ids.length;
    }

    holes.push({ holeNumber, pointsByPlayer });
    for (const [id, pts] of pointsByPlayer) totalsByPlayer.set(id, (totalsByPlayer.get(id) ?? 0) + pts);
  }

  return { holes, totalsByPlayer };
}
