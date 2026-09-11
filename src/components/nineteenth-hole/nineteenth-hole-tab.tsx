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
      <Card>
        <CardHeader>
          <CardTitle>The 19th Hole</CardTitle>
          <CardDescription>The stats that don&apos;t make the scorecard.</CardDescription>
        </CardHeader>
        <CardContent>
          {isCaptain ? (
            <div className="space-y-3">
              <p className="text-sm text-charcoal-500">
                Track drinks, birdies, three-putts, lost balls, and whatever else your group wants bragging
                (or shaming) rights over. Off by default — turn it on whenever you&apos;re ready.
              </p>
              {enableError && <p className="text-sm text-red-600">{enableError}</p>}
              <Button
                type="button"
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
                {isEnabling ? "Enabling…" : "Enable The 19th Hole"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-charcoal-500">
              The 19th Hole hasn&apos;t been turned on for this trip yet. Ask a captain to enable it from
              here.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gold-300/70 bg-gradient-to-br from-gold-50 via-cream-50 to-gold-100">
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
            <CardTitle>🎉 The 19th Hole</CardTitle>
            <CardDescription>The stats that don&apos;t make the scorecard.</CardDescription>
          </div>
          {isCaptain && (
            <button
              type="button"
              onClick={() => setShowSetup((v) => !v)}
              aria-label="Configure The 19th Hole"
              aria-pressed={showSetup}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                showSetup ? "bg-forest-800 text-cream-50" : "text-charcoal-500 hover:bg-cream-100",
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
          <div className="flex w-fit gap-1 rounded-full bg-gold-100/80 p-1">
            {SUB_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setSubView(v.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-medium transition-colors",
                  subView === v.key
                    ? "bg-forest-800 text-cream-50 shadow-sm"
                    : "text-charcoal-600 hover:text-charcoal",
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
