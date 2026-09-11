"use client";

import { useState, useTransition } from "react";
import { Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreCelebration } from "@/components/ui/celebration";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { disableNineteenthHoleAction, enableNineteenthHoleAction } from "@/actions/nineteenth-hole";
import { NineteenthHoleSetupPanel } from "@/components/nineteenth-hole/setup-panel";
import { NineteenthHoleQuickAdd } from "@/components/nineteenth-hole/quick-add";
import { NineteenthHoleStandings } from "@/components/nineteenth-hole/standings-view";
import { NineteenthHoleActivityList } from "@/components/nineteenth-hole/activity-list";
import type {
  NineteenthHoleActivityEntry,
  NineteenthHoleCounter,
  NineteenthHoleMember,
  NineteenthHoleRound,
  NineteenthHoleSettings,
} from "@/components/nineteenth-hole/types";

type SubView = "quickadd" | "standings" | "activity";

const SUB_VIEWS: { key: SubView; label: string }[] = [
  { key: "quickadd", label: "Quick Add" },
  { key: "standings", label: "Standings" },
  { key: "activity", label: "Activity" },
];

// The 19th Hole is the one place in the app meant to feel like the
// clubhouse bar after a round rather than the scorecard -- a dark
// "lounge" card (still built from the app's own forest/gold/cream
// palette, nothing off-brand) instead of the usual white card, so
// clicking into it reads as a real change of scene. Applies to both
// the "come enable this" gate and the live view, so the vibe doesn't
// jarringly flip only once a captain turns it on.
const PARTY_CARD_CLASSES =
  "relative overflow-hidden border-gold-400/25 bg-gradient-to-b from-forest-950 via-forest-900 to-forest-950 text-cream-50";

const LIGHT_COLORS = ["#DAB86D", "#FDFBF6", "#C9A24E"];

/** A string of small party lights along the top edge of the card, each
 * gently twinkling out of phase. motion-safe: means the twinkle is a
 * pure CSS media-query variant -- it simply doesn't apply (lights stay
 * lit, no JS branching needed) under prefers-reduced-motion. */
function PartyLights() {
  const bulbs = Array.from({ length: 11 });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-6 top-0 flex -translate-y-1/2 justify-between sm:inset-x-10"
    >
      {bulbs.map((_, i) => {
        const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
        return (
          <span
            key={i}
            className="motion-safe:animate-pulse h-2 w-2 rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 6px 2px ${color}99`,
              animationDelay: `${(i % 5) * 220}ms`,
              animationDuration: "2600ms",
            }}
          />
        );
      })}
    </div>
  );
}

/** A soft gold glow behind the header -- a stage-light wash rather
 * than a hard edge, purely decorative and never interactive. */
function PartyGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-gold-400/20 blur-3xl"
    />
  );
}

export function NineteenthHoleTab({
  tripId,
  isCaptain,
  currentUserId,
  members,
  rounds,
  recorderNameByUserId,
  initialSettings,
  initialCounters,
  initialActivity,
  initialRoundId = null,
}: {
  tripId: string;
  isCaptain: boolean;
  currentUserId: string;
  members: NineteenthHoleMember[];
  rounds: NineteenthHoleRound[];
  recorderNameByUserId: Record<string, string>;
  initialSettings: NineteenthHoleSettings | null;
  initialCounters: NineteenthHoleCounter[];
  initialActivity: NineteenthHoleActivityEntry[];
  initialRoundId?: string | null;
}) {
  const [settings, setSettings] = useState<NineteenthHoleSettings>(
    initialSettings ?? { enabled: false, whoCanRecord: "everyone" },
  );
  const [counters, setCounters] = useState<NineteenthHoleCounter[]>(initialCounters);
  const [activity, setActivity] = useState<NineteenthHoleActivityEntry[]>(initialActivity);
  const [subView, setSubView] = useState<SubView>("quickadd");
  const [showSetup, setShowSetup] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [isEnabling, startEnabling] = useTransition();
  const [enableError, setEnableError] = useState<string | null>(null);

  const activeCounters = counters.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedCounterId, setSelectedCounterId] = useState<string | null>(activeCounters[0]?.id ?? null);
  const [quickAddRoundId, setQuickAddRoundId] = useState<string | null>(initialRoundId);
  const [standingsRoundId, setStandingsRoundId] = useState<string | null>(initialRoundId);

  function patchSettings(patch: Partial<NineteenthHoleSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function addActivity(entry: NineteenthHoleActivityEntry) {
    setActivity((prev) => [entry, ...prev]);
  }

  function markCorrected(activityId: string) {
    setActivity((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, deletedAt: new Date().toISOString() } : a)),
    );
  }

  function ensureSelectedCounter(next: NineteenthHoleCounter[]) {
    const stillActive = next.some((c) => c.id === selectedCounterId && c.isActive);
    if (!stillActive) {
      const firstActive = [...next].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)[0];
      setSelectedCounterId(firstActive?.id ?? null);
    }
  }

  if (!settings.enabled) {
    return (
      <Card className={PARTY_CARD_CLASSES}>
        <PartyGlow />
        <PartyLights />
        <CardHeader>
          <CardTitle className="text-cream-50">🎉 The 19th Hole</CardTitle>
          <CardDescription className="text-gold-200/80">
            The stats that don&apos;t make the scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCaptain ? (
            <div className="space-y-3">
              <p className="text-sm text-cream-100/80">
                Track drinks, birdies, three-putts, lost balls, and whatever else your group wants bragging
                (or shaming) rights over. Off by default — turn it on whenever you&apos;re ready.
              </p>
              {enableError && <p className="text-sm text-red-300">{enableError}</p>}
              <Button
                type="button"
                variant="gold"
                size="lg"
                disabled={isEnabling}
                onClick={() => {
                  setEnableError(null);
                  startEnabling(async () => {
                    try {
                      const result = await enableNineteenthHoleAction(tripId);
                      setSettings(result.settings);
                      setCounters(result.counters);
                      if (selectedCounterId === null) {
                        const firstActive = result.counters.find((c) => c.isActive);
                        if (firstActive) setSelectedCounterId(firstActive.id);
                      }
                    } catch (err) {
                      setEnableError(err instanceof Error ? err.message : "Couldn't enable The 19th Hole.");
                    }
                  });
                }}
              >
                {isEnabling ? "Enabling…" : "🎉 Enable The 19th Hole"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-cream-100/80">
              The 19th Hole hasn&apos;t been turned on for this trip yet. Ask a captain to enable it from
              here.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={PARTY_CARD_CLASSES}>
      <PartyGlow />
      <PartyLights />
      {/* One confetti burst each time this tab is opened -- the same
          particle effect a birdie gets elsewhere in the app (see
          ScoreCelebration), reused here so entering The 19th Hole
          reads as a deliberate "the vibes just changed" moment rather
          than a generic screen. `trigger` is a constant because this
          whole component remounts every time the tab is switched to,
          which is exactly the "each time you click in" cadence wanted. */}
      <ScoreCelebration trigger="nineteenth-hole-opened" label="🎉 Welcome to the 19th Hole" fixed />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-cream-50">🎉 The 19th Hole</CardTitle>
            <CardDescription className="text-gold-200/80">
              The stats that don&apos;t make the scorecard.
            </CardDescription>
          </div>
          {isCaptain && (
            <button
              type="button"
              onClick={() => setShowSetup((v) => !v)}
              aria-label="Configure The 19th Hole"
              aria-pressed={showSetup}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                showSetup ? "bg-gold-400 text-forest-950" : "text-gold-200 hover:bg-white/10",
              )}
            >
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {showSetup && isCaptain && (
          <div className="rounded-2xl bg-cream-100/60 p-4">
            <NineteenthHoleSetupPanel
              tripId={tripId}
              settings={settings}
              counters={counters}
              onSettingsChange={patchSettings}
              onCountersChange={(updater) =>
                setCounters((prev) => {
                  const next = updater(prev);
                  ensureSelectedCounter(next);
                  return next;
                })
              }
            />
            <div className="mt-4 border-t border-forest-900/[0.08] pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setConfirmDisable(true)}
              >
                Disable The 19th Hole
              </Button>
              <p className="mt-1.5 text-xs text-charcoal-400">
                Hides this feature for the trip. Nothing recorded is deleted — turn it back on any time.
              </p>
            </div>
          </div>
        )}

        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <div className="flex w-fit gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/10">
            {SUB_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setSubView(v.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-medium transition-colors",
                  subView === v.key
                    ? "bg-gold-400 text-forest-950 shadow-sm"
                    : "text-gold-100/80 hover:text-cream-50",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {subView === "quickadd" && (
          <NineteenthHoleQuickAdd
            tripId={tripId}
            currentUserId={currentUserId}
            canRecord={isCaptain || settings.whoCanRecord === "everyone"}
            members={members}
            rounds={rounds}
            counters={counters}
            activity={activity}
            selectedCounterId={selectedCounterId}
            onSelectCounter={setSelectedCounterId}
            selectedRoundId={quickAddRoundId}
            onSelectRound={setQuickAddRoundId}
            onActivityAdded={addActivity}
            onActivityCorrected={markCorrected}
          />
        )}

        {subView === "standings" && (
          <NineteenthHoleStandings
            members={members}
            rounds={rounds}
            counters={counters}
            activity={activity}
            selectedCounterId={selectedCounterId}
            onSelectCounter={setSelectedCounterId}
            selectedRoundId={standingsRoundId}
            onSelectRound={setStandingsRoundId}
          />
        )}

        {subView === "activity" && (
          <NineteenthHoleActivityList
            tripId={tripId}
            isCaptain={isCaptain}
            currentUserId={currentUserId}
            members={members}
            rounds={rounds}
            counters={counters}
            activity={activity}
            recorderNameByUserId={recorderNameByUserId}
            onCorrected={markCorrected}
          />
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title="Disable The 19th Hole?"
        description="This hides Quick Add, Standings and Activity for everyone on the trip. Every counter and every recorded entry stays saved, and a captain can turn it back on any time."
        confirmLabel="Disable"
        onConfirm={async () => {
          await disableNineteenthHoleAction(tripId);
          setSettings((prev) => ({ ...prev, enabled: false }));
          setShowSetup(false);
        }}
      />
    </Card>
  );
}
