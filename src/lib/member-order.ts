type OrderableMember = { display_name: string; role: string; status: string };

/**
 * Active captain(s) first (alphabetically among themselves if there's
 * more than one), then everyone else alphabetically by display name.
 * Used everywhere a trip's golfer list is shown so the order doesn't
 * just reflect created_at/join order -- which only looked like
 * "captain on top" because whoever creates a trip is usually its
 * first member. Doesn't mutate the input array.
 */
export function sortMembersCaptainFirst<T extends OrderableMember>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const aRank = a.role === "captain" && a.status === "active" ? 0 : 1;
    const bRank = b.role === "captain" && b.status === "active" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" });
  });
}
