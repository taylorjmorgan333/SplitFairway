"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Share2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { TripModeMiniPreview } from "@/components/marketing/trip-mode-mini-preview";

const NAV_ICON_PATHS = {
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 10.5 12 3l9 7.5M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"
    />
  ),
  plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
} as const;

const TABS = ["Scorecard", "Games", "19th Hole"] as const;
type TabName = (typeof TABS)[number];

/** A tiny segmented-control echo of the real round nav -- Scorecard,
 * Games, 19th Hole. No separate Leaderboard tab: the live leaderboard
 * lives inside the Scorecard experience, same as the real app. */
function MiniTabs({ active }: { active: TabName }) {
  return (
    <div className="flex gap-1 rounded-full bg-cream-100 p-0.5">
      {TABS.map((tab) => (
        <div
          key={tab}
          className={`flex-1 rounded-full py-1 text-center text-[8.5px] font-medium transition-colors duration-300 ${
            active === tab ? "bg-forest-900 text-cream-50" : "text-charcoal-400"
          }`}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}

type ScoreStep = "idle" | "pressed" | "updated" | "saved";
type GameStep = "idle" | "highlight" | "updated";
type LeaderboardStep = "idle" | "updated";

type Scene = {
  id: number;
  label: string;
  caption: string;
  holdMs: number;
};

// Roughly 13.4s per full loop -- inside the 12-15s target -- with each
// scene held long enough to read (2.4-3.2s) and short enough that the
// loop never drags. Only the values below are on-screen "canned" demo
// data; nothing here calls the app, Supabase, or real scoring logic.
const SCENES: Scene[] = [
  { id: 0, label: "start round", caption: "Start with your saved group", holdMs: 2400 },
  { id: 1, label: "score entry", caption: "Enter everyone’s scores in seconds", holdMs: 2800 },
  { id: 2, label: "games", caption: "Games update automatically", holdMs: 2600 },
  { id: 3, label: "live leaderboard", caption: "Follow the live leaderboard", holdMs: 2600 },
  { id: 4, label: "19th hole", caption: "Finish in the 19th Hole", holdMs: 3200 },
];

const GOLFERS = ["Taylor", "Cody", "JP", "Trent"] as const;

const NINETEENTH_STATS = [
  { label: "Winner", value: "Taylor" },
  { label: "Skins Leader", value: "JP" },
  { label: "Longest Drive", value: "Cody" },
  { label: "Drinks", value: "Trent · 4" },
  { label: "Lost Balls", value: "Cody · 2" },
  { label: "Mulligans", value: "Taylor · 1" },
] as const;

/**
 * The hero's animated product walkthrough -- a self-contained loop of
 * five scenes (start a round, enter scores, games update, live
 * leaderboard, 19th Hole recap) recreated at phone scale from the real
 * app's actual screens, the same way the previous static RoundPreview
 * was. Everything shown is fixed, local mock data (see GOLFERS/
 * NINETEENTH_STATS above) -- no network requests, no Supabase, no real
 * scoring math, nothing that touches the authenticated app.
 *
 * The phone frame itself never moves; only the content inside one
 * fixed-size screen area crossfades between scenes (same technique the
 * old PhonePreview used, see git history). Autoplay only runs while
 * the demo is genuinely visible and welcome:
 * - in the viewport (IntersectionObserver),
 * - the tab is in the foreground (document.visibilityState),
 * - the visitor hasn't paused it, and
 * - prefers-reduced-motion isn't set (in which case it never
 *   autoplays at all -- it opens straight on the score-entry scene in
 *   its finished state and stays there until a scene dot is clicked).
 *
 * All animation is timeout-driven and re-derived from React state
 * (`sceneIndex` + `playing`), never a persisted ref-guarded loop, so
 * every effect below cleans up its own timers on every dependency
 * change and on unmount -- nothing can double-schedule or leak.
 */
export function HeroPhoneDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Sub-beat state for each scene's one-shot micro-animation. Each
  // defaults to its settled/finished value so the very first paint --
  // before the viewport/visibility effects below have had a chance to
  // run, and permanently under prefers-reduced-motion -- is always a
  // complete, readable frame rather than a mid-animation one.
  const [startPressed, setStartPressed] = useState(false);
  const [scoreStep, setScoreStep] = useState<ScoreStep>("saved");
  const [gameStep, setGameStep] = useState<GameStep>("updated");
  const [leaderboardStep, setLeaderboardStep] = useState<LeaderboardStep>("updated");
  const [tripEmphasis, setTripEmphasis] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // prefers-reduced-motion: detect once, keep listening in case the
  // visitor's OS setting changes mid-visit, and open on the finished
  // score-entry/leaderboard scene rather than the first scene, since
  // there's no tour to arrive there naturally.
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      setReducedMotion(true);
      setSceneIndex(1);
    }
    function handleChange(e: MediaQueryListEvent) {
      setReducedMotion(e.matches);
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Autoplay only while the demo is actually on screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ...and only while the tab itself is in the foreground.
  useEffect(() => {
    function handleVisibility() {
      setPageVisible(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const playing = !reducedMotion && !userPaused && inView && pageVisible;

  // Advances to the next scene after the current one's hold time --
  // the single timer driving the loop. Pausing for any reason simply
  // means this effect's cleanup fires and no replacement timer is
  // scheduled, so the demo freezes exactly where it is; resuming
  // restarts the current scene's hold from the top rather than trying
  // to resume mid-count, which is simpler and imperceptible in practice.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setSceneIndex((i) => (i + 1) % SCENES.length);
    }, SCENES[sceneIndex].holdMs);
    return () => window.clearTimeout(timer);
  }, [sceneIndex, playing]);

  // Each scene's own internal micro-animation (a button press, a score
  // updating, a game recalculating, a leaderboard position ticking, the
  // Trip Mode card being emphasized). Not playing -> every sub-state
  // snaps straight to its finished value with no timers at all, which
  // is what keeps a paused/reduced-motion view "polished static"
  // rather than stuck mid-gesture.
  useEffect(() => {
    setTripEmphasis(false);

    if (!playing) {
      setStartPressed(false);
      setScoreStep("saved");
      setGameStep("updated");
      setLeaderboardStep("updated");
      return;
    }

    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    if (sceneIndex === 0) {
      setStartPressed(false);
      after(900, () => setStartPressed(true));
      after(1080, () => setStartPressed(false));
    } else if (sceneIndex === 1) {
      setScoreStep("idle");
      after(800, () => setScoreStep("pressed"));
      after(950, () => setScoreStep("updated"));
      after(1200, () => setScoreStep("saved"));
    } else if (sceneIndex === 2) {
      setGameStep("idle");
      after(800, () => setGameStep("highlight"));
      after(1150, () => setGameStep("updated"));
    } else if (sceneIndex === 3) {
      setLeaderboardStep("idle");
      after(900, () => setLeaderboardStep("updated"));
    } else if (sceneIndex === 4) {
      after(1900, () => setTripEmphasis(true));
    }

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [sceneIndex, playing]);

  const trentScore = scoreStep === "idle" || scoreStep === "pressed" ? 5 : 6;
  const jpSkins = gameStep === "updated" ? 3 : 2;
  const jpToPar = leaderboardStep === "updated" ? "E" : "+1";

  return (
    <div className="flex flex-col items-center lg:items-end">
      <div ref={containerRef} className="relative w-[250px] shrink-0 sm:w-[270px]">
        <div aria-hidden="true" className="rounded-[2.75rem] border-[6px] border-cream-50/10 bg-forest-900 p-1.5 shadow-2xl shadow-black/50">
          <div className="relative h-[480px] overflow-hidden rounded-[2.15rem] bg-cream-50 sm:h-[540px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
              <div className="h-5 w-24 rounded-full bg-forest-950" />
            </div>

            <div className="flex h-full flex-col pt-8">
              <div className="flex items-center justify-between border-b border-forest-900/[0.06] px-3.5 py-2.5">
                <div className="origin-left scale-[0.82]">
                  <Logo />
                </div>
                <div className="h-6 w-6 rounded-full bg-forest-800/10" />
              </div>

              <div className="relative flex-1">
                {/* Scene 0: Start the round */}
                <div
                  className="absolute inset-0 flex flex-col justify-between px-3.5 py-3.5 transition-opacity duration-[400ms] ease-out"
                  style={{
                    opacity: sceneIndex === 0 ? 1 : 0,
                    pointerEvents: sceneIndex === 0 ? "auto" : "none",
                  }}
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">
                        Saturday Group
                      </p>
                      <p className="mt-1 font-serif text-base text-forest-900">Plum Creek Golf Club</p>
                      <p className="text-[10px] text-charcoal-500">18 holes</p>
                    </div>

                    <div className="flex -space-x-1.5">
                      {GOLFERS.map((name) => (
                        <div
                          key={name}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-cream-50 bg-forest-900/10 text-[10px] font-semibold text-forest-900"
                        >
                          {name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-charcoal-500">
                      {GOLFERS.join(", ")}
                    </p>

                    <span className="inline-flex items-center rounded-full bg-gold-50 px-2.5 py-1 text-[9px] font-medium text-gold-700">
                      Skins enabled
                    </span>
                  </div>

                  <div
                    className="rounded-full bg-gold-400 py-3 text-center text-xs font-semibold text-forest-950 shadow-card transition-transform duration-150 ease-out"
                    style={{ transform: startPressed ? "scale(0.96)" : "scale(1)" }}
                  >
                    Start Scoring
                  </div>
                </div>

                {/* Scene 1: Enter scores */}
                <div
                  className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-[400ms] ease-out"
                  style={{
                    opacity: sceneIndex === 1 ? 1 : 0,
                    pointerEvents: sceneIndex === 1 ? "auto" : "none",
                  }}
                >
                  <p className="text-[10px] font-medium text-charcoal-400">Plum Creek Golf Club</p>
                  <MiniTabs active="Scorecard" />
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Hole 7</p>
                    <p className="text-[10px] text-charcoal-500">Par 4 · 385 yds</p>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { name: "Taylor", score: 4 },
                      { name: "Cody", score: 5 },
                      { name: "JP", score: 4 },
                      { name: "Trent", score: trentScore },
                    ].map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2"
                      >
                        <span className="text-[11px] font-medium text-charcoal-700">{row.name}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-900/10 text-forest-900 transition-transform duration-150 ease-out"
                            style={{
                              transform:
                                row.name === "Trent" && scoreStep === "pressed" ? "scale(0.85)" : "scale(1)",
                            }}
                          >
                            <span className="text-sm font-medium leading-none">–</span>
                          </div>
                          <span className="w-4 text-center font-serif text-base tabular-nums text-forest-900">
                            {row.score}
                          </span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-900/10 text-forest-900">
                            <span className="text-sm font-medium leading-none">+</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p
                    className="text-[9px] font-medium text-forest-700 transition-opacity duration-300 ease-out"
                    style={{ opacity: scoreStep === "saved" ? 1 : 0 }}
                  >
                    Saved
                  </p>
                </div>

                {/* Scene 2: Games update automatically */}
                <div
                  className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-[400ms] ease-out"
                  style={{
                    opacity: sceneIndex === 2 ? 1 : 0,
                    pointerEvents: sceneIndex === 2 ? "auto" : "none",
                  }}
                >
                  <p className="text-[10px] font-medium text-charcoal-400">Plum Creek Golf Club</p>
                  <MiniTabs active="Games" />

                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Skins</p>
                    <div className="mt-1.5 space-y-1.5">
                      {[
                        { name: "Taylor", skins: 2 },
                        { name: "Cody", skins: 1 },
                        { name: "JP", skins: jpSkins },
                        { name: "Trent", skins: 0 },
                      ].map((row) => (
                        <div
                          key={row.name}
                          className="flex items-center justify-between rounded-lg px-1.5 py-1 transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor:
                              row.name === "JP" && gameStep !== "idle" ? "rgba(201,162,78,0.15)" : "transparent",
                          }}
                        >
                          <span className="text-[11px] font-medium text-charcoal-700">{row.name}</span>
                          <span className="text-[11px] font-medium tabular-nums text-forest-700">
                            {row.skins} {row.skins === 1 ? "skin" : "skins"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-xl bg-gold-50 px-3 py-2 text-center transition-all duration-300 ease-out"
                    style={{
                      opacity: gameStep === "idle" ? 0 : 1,
                      transform: gameStep === "idle" ? "translateY(4px)" : "translateY(0)",
                    }}
                  >
                    <p className="text-[10px] font-medium text-forest-900">JP wins Hole 7</p>
                  </div>
                </div>

                {/* Scene 3: Live leaderboard */}
                <div
                  className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-[400ms] ease-out"
                  style={{
                    opacity: sceneIndex === 3 ? 1 : 0,
                    pointerEvents: sceneIndex === 3 ? "auto" : "none",
                  }}
                >
                  <p className="text-[10px] font-medium text-charcoal-400">Plum Creek Golf Club</p>
                  <MiniTabs active="Scorecard" />
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">
                      Through Hole 7
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Leaderboard</p>
                    <div className="mt-1.5 space-y-1.5">
                      {[
                        { name: "Taylor", toPar: "−2" },
                        { name: "JP", toPar: jpToPar },
                        { name: "Cody", toPar: "+1" },
                        { name: "Trent", toPar: "+3" },
                      ].map((row, i) => (
                        <div key={row.name} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-charcoal-700">
                            {i + 1}. {row.name}
                          </span>
                          <span
                            className="font-medium tabular-nums text-forest-700 transition-colors duration-300 ease-out"
                            style={{ color: row.name === "JP" && leaderboardStep === "updated" ? "#8F6F30" : undefined }}
                          >
                            {row.toPar}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Scene 4: The 19th Hole */}
                <div
                  className="absolute inset-0 space-y-2.5 px-3.5 py-3.5 transition-opacity duration-[400ms] ease-out"
                  style={{
                    opacity: sceneIndex === 4 ? 1 : 0,
                    pointerEvents: sceneIndex === 4 ? "auto" : "none",
                  }}
                >
                  <MiniTabs active="19th Hole" />
                  <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Round Recap</p>

                  <div className="grid grid-cols-2 gap-1.5">
                    {NINETEENTH_STATS.map((stat) => (
                      <div key={stat.label} className="rounded-lg bg-cream-100 px-2.5 py-2">
                        <p className="text-[8px] font-medium uppercase tracking-wide text-charcoal-400">
                          {stat.label}
                        </p>
                        <p className="mt-0.5 text-[10.5px] font-medium text-forest-900">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-1.5 rounded-full border border-forest-900/15 py-1.5 text-[10px] font-medium text-forest-800">
                    <Share2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    Share Recap
                  </div>
                </div>
              </div>

              <div className="flex border-t border-forest-900/[0.08] bg-cream-50/95 px-2 py-1.5">
                {(["home", "plus", "user"] as const).map((icon) => (
                  <div key={icon} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-charcoal-500">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                      {NAV_ICON_PATHS[icon]}
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-cream-50/30" />
        </div>
      </div>

      {/* Trip Mode reminder -- gently emphasized near the end of the
          19th Hole scene (see tripEmphasis above) to connect the loop's
          story back to it, but never resized or repositioned, so it
          can't grow more visually dominant than the phone itself. */}
      <TripModeMiniPreview emphasize={tripEmphasis} />

      {/* Caption + manual controls: deliberately outside the aria-hidden
          phone frame above, since these need to be reachable by
          keyboard and screen readers even though the phone mockup
          itself is decorative. No aria-live region -- the caption text
          changes with the scene, but a repeating announcement every
          few seconds would be more disruptive than helpful here. */}
      <div className="mt-3 w-[250px] text-center sm:mt-4 sm:w-[270px]">
        <p className="text-sm text-cream-100/70">{SCENES[sceneIndex].caption}</p>

        <div className="mt-2 flex items-center justify-center gap-3 sm:mt-3">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Play automatic preview" : "Pause automatic preview"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-cream-100/70 transition-colors hover:bg-cream-50/10 hover:text-cream-50"
          >
            {userPaused ? (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>

          <div className="flex items-center gap-2">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => setSceneIndex(scene.id)}
                aria-label={`Show the ${scene.label} scene`}
                aria-current={sceneIndex === scene.id}
                className="flex h-6 w-6 items-center justify-center"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      sceneIndex === scene.id ? "rgba(253,251,246,0.9)" : "rgba(253,251,246,0.3)",
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
