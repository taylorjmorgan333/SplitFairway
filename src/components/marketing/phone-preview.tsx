"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { ScoreCelebration } from "@/components/ui/celebration";

const NAV_ICONS = {
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
  check: <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />,
};

type BalanceRow = {
  name: string;
  amt: string;
  tone: string;
  justSettled?: boolean;
};

const BALANCE_ROWS: BalanceRow[] = [
  { name: "Sam", amt: "Owed $118", tone: "text-forest-700" },
  { name: "Jordan", amt: "Settled up", tone: "text-charcoal-400", justSettled: true },
  { name: "Riley", amt: "Owes $64", tone: "text-gold-700" },
];

const GAMES = [
  { key: "skins", label: "Skins" },
  { key: "nassau", label: "Nassau" },
  { key: "match", label: "Match Play" },
] as const;

type GameKey = (typeof GAMES)[number]["key"];
type Scene = "dashboard" | "games" | "score" | "expense";

const EXPENSE_PAYERS = ["Mike", "Sam"] as const;
type ExpensePayer = (typeof EXPENSE_PAYERS)[number];
const EXPENSE_AMOUNT = "42";
const EXPENSE_FOR = "Dinner at The Lodge";

const TARGET_BALANCE = 342;
const ROW_STAGGER_MS = 160;

// Timing for the looping "tour" that plays after the initial dashboard
// boot-up: how long each screen holds before the mockup moves on, and
// how long each little tap/press effect lasts along the way.
const HOLD_DASHBOARD_MS = 2200;
const HOLD_GAMES_MS = 1400;
const HOLD_SCORE_MS = 1300;
const HOLD_EXPENSE_MS = 1900;
const PRESS_MS = 110;
const TYPE_CHAR_MS = 35;

/** A tiny segmented-control echo of the real round nav (Scorecard / Games /
 * Leaderboard) so the games and score screens read as two tabs of one
 * round, not two unrelated apps. */
function MiniTabs({ active }: { active: "score" | "games" }) {
  const tabs = [
    { key: "score", label: "Scorecard" },
    { key: "games", label: "Games" },
    { key: "board", label: "Leaderboard" },
  ] as const;
  return (
    <div className="flex gap-1 rounded-full bg-cream-100 p-0.5">
      {tabs.map((t) => (
        <div
          key={t.key}
          className={`flex-1 rounded-full py-1 text-center text-[8.5px] font-medium transition-colors duration-300 ${
            active === t.key ? "bg-forest-900 text-cream-50" : "text-charcoal-400"
          }`}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}

function wait(ms: number, timers: number[]) {
  return new Promise<void>((resolve) => {
    timers.push(window.setTimeout(resolve, ms));
  });
}

/**
 * A pure-CSS recreation of the actual mobile app — no stock device
 * photography, no glassy/skeuomorphic mockup styling. It mirrors four
 * real screens at phone scale (the "your balance" dashboard, the round's
 * game picker, hole-by-hole score entry, and adding an expense — see
 * MyBalanceHero in trip-tabs.tsx, GameTypePicker, mobile-scorecard.tsx,
 * and the expense form), so what a visitor sees here is what they'll
 * actually get after signing up.
 *
 * On mount it plays the dashboard's boot-up once (balance counts up, rows
 * stagger in, Jordan's checkmark pops), then loops a short silent "tour":
 * dashboard -> tap into Games and pick Skins -> tap into the Scorecard and
 * log a birdie (with a little on-screen celebration) -> add an expense for
 * the group -> back to the dashboard. Every step is a state change on
 * canned, clearly-fictional data, not a live simulation.
 *
 * Purely decorative (the container stays aria-hidden, so none of this
 * reaches a screen reader), guarded against React StrictMode's
 * double-invoked effects, and skips straight to the finished dashboard
 * with no looping for prefers-reduced-motion or if JS never runs.
 */
export function PhonePreview() {
  const [balance, setBalance] = useState(TARGET_BALANCE);
  const [visibleRows, setVisibleRows] = useState(BALANCE_ROWS.length);
  const [settledPop, setSettledPop] = useState(true);

  const [scene, setScene] = useState<Scene>("dashboard");
  const [gamePressed, setGamePressed] = useState<GameKey | null>(null);
  const [gameSelected, setGameSelected] = useState<GameKey | null>(null);
  const [scoreValue, setScoreValue] = useState(4);
  const [scorePressed, setScorePressed] = useState<"plus" | "minus" | null>(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [birdieTrigger, setBirdieTrigger] = useState<number | null>(null);

  const [expenseAmountText, setExpenseAmountText] = useState("");
  const [expensePayerPressed, setExpensePayerPressed] = useState<ExpensePayer | null>(null);
  const [expensePayerSelected, setExpensePayerSelected] = useState<ExpensePayer | null>(null);
  const [expenseForText, setExpenseForText] = useState("");
  const [expenseSaved, setExpenseSaved] = useState(false);

  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;
    let frame = 0;
    const timers: number[] = [];

    const countUpBalance = () =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        const durationMs = 900;
        const tick = (now: number) => {
          if (cancelled) {
            resolve();
            return;
          }
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setBalance(Math.round(eased * TARGET_BALANCE));
          if (progress < 1) {
            frame = requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        frame = requestAnimationFrame(tick);
      });

    // Reveals `value` into `setValue` a character at a time, like someone
    // typing it into a text field -- used for the expense amount and
    // description so that scene reads as data being entered, not just
    // appearing.
    async function typeText(setValue: (v: string) => void, value: string) {
      for (let i = 1; i <= value.length; i++) {
        setValue(value.slice(0, i));
        await wait(TYPE_CHAR_MS, timers);
        if (cancelled) return;
      }
    }

    async function run() {
      // One-time boot-up.
      setBalance(0);
      setVisibleRows(0);
      setSettledPop(false);
      await countUpBalance();
      if (cancelled) return;
      for (let i = 0; i < BALANCE_ROWS.length; i++) {
        await wait(ROW_STAGGER_MS, timers);
        if (cancelled) return;
        setVisibleRows((v) => Math.max(v, i + 1));
      }
      await wait(200, timers);
      if (cancelled) return;
      setSettledPop(true);

      // Looping tour: dashboard -> pick a game -> log a birdie -> add an
      // expense -> repeat.
      while (!cancelled) {
        await wait(HOLD_DASHBOARD_MS, timers);
        if (cancelled) return;

        setScene("games");
        setGameSelected(null);
        setGamePressed(null);
        await wait(450, timers);
        if (cancelled) return;
        setGamePressed("skins");
        await wait(PRESS_MS, timers);
        if (cancelled) return;
        setGamePressed(null);
        setGameSelected("skins");
        await wait(HOLD_GAMES_MS, timers);
        if (cancelled) return;

        setScene("score");
        setScoreValue(4);
        setScoreSaved(false);
        setScorePressed(null);
        await wait(450, timers);
        if (cancelled) return;
        setScorePressed("minus");
        await wait(PRESS_MS, timers);
        if (cancelled) return;
        setScorePressed(null);
        setScoreValue(3);
        await wait(280, timers);
        if (cancelled) return;
        setScoreSaved(true);
        setBirdieTrigger((n) => (n ?? 0) + 1);
        await wait(HOLD_SCORE_MS, timers);
        if (cancelled) return;

        setScene("expense");
        setExpenseAmountText("");
        setExpensePayerPressed(null);
        setExpensePayerSelected(null);
        setExpenseForText("");
        setExpenseSaved(false);
        await wait(350, timers);
        if (cancelled) return;
        await typeText(setExpenseAmountText, EXPENSE_AMOUNT);
        if (cancelled) return;
        await wait(220, timers);
        if (cancelled) return;
        setExpensePayerPressed("Mike");
        await wait(PRESS_MS, timers);
        if (cancelled) return;
        setExpensePayerPressed(null);
        setExpensePayerSelected("Mike");
        await wait(220, timers);
        if (cancelled) return;
        await typeText(setExpenseForText, EXPENSE_FOR);
        if (cancelled) return;
        await wait(220, timers);
        if (cancelled) return;
        setExpenseSaved(true);
        await wait(HOLD_EXPENSE_MS, timers);
        if (cancelled) return;

        setScene("dashboard");
      }
    }

    run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <div aria-hidden="true" className="relative w-[250px] shrink-0 sm:w-[270px]">
      <div className="rounded-[2.75rem] border-[6px] border-cream-50/10 bg-forest-900 p-1.5 shadow-2xl shadow-black/50">
        <div className="relative h-[510px] overflow-hidden rounded-[2.15rem] bg-cream-50">
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

            <div className="relative flex-1 overflow-hidden">
              {/* Dashboard */}
              <div
                className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-300 ease-out"
                style={{
                  opacity: scene === "dashboard" ? 1 : 0,
                  pointerEvents: scene === "dashboard" ? "auto" : "none",
                }}
              >
                <p className="text-[10px] font-medium text-charcoal-400">Pebble Beach Weekend</p>

                <div className="rounded-2xl bg-forest-950 p-3.5 text-cream-50">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-cream-100/60">
                    Your balance
                  </p>
                  <p className="mt-1 text-2xl font-medium tabular-nums">${balance}</p>
                  <p className="mt-0.5 text-[10px] text-cream-100/75">You owe the group</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {(["plus", "check", "check"] as const).map((icon, i) => (
                      <div
                        key={i}
                        className="flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg bg-cream-50/10"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                          {NAV_ICONS[icon]}
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {BALANCE_ROWS.map((row, i) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2 transition-all duration-500 ease-out"
                      style={{
                        opacity: i < visibleRows ? 1 : 0,
                        transform: i < visibleRows ? "translateY(0)" : "translateY(4px)",
                      }}
                    >
                      <span className="text-[11px] font-medium text-charcoal">{row.name}</span>
                      <span
                        className={`flex items-center gap-1 text-[10px] font-medium tabular-nums ${row.tone}`}
                      >
                        {row.justSettled && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            className="h-2.5 w-2.5 shrink-0 transition-transform duration-300 ease-out"
                            style={{ transform: settledPop ? "scale(1)" : "scale(0)" }}
                          >
                            {NAV_ICONS.check}
                          </svg>
                        )}
                        {row.amt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Games */}
              <div
                className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-300 ease-out"
                style={{
                  opacity: scene === "games" ? 1 : 0,
                  pointerEvents: scene === "games" ? "auto" : "none",
                }}
              >
                <MiniTabs active="games" />
                <p className="text-[10px] font-medium text-charcoal-400">Choose your games</p>
                <div className="space-y-1.5">
                  {GAMES.map((game) => {
                    const isSelected = gameSelected === game.key;
                    const isPressed = gamePressed === game.key;
                    return (
                      <div
                        key={game.key}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors duration-200 ${
                          isSelected
                            ? "border-forest-900 bg-forest-900 text-cream-50"
                            : "border-cream-200 bg-cream-50 text-charcoal-700"
                        }`}
                        style={{
                          transform: isPressed ? "scale(0.96)" : "scale(1)",
                          transition: "transform 150ms ease-out, background-color 200ms ease-out, color 200ms ease-out, border-color 200ms ease-out",
                        }}
                      >
                        <span className="text-[11px] font-medium">{game.label}</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          className="h-3 w-3 shrink-0 transition-transform duration-200 ease-out"
                          style={{ transform: isSelected ? "scale(1)" : "scale(0)" }}
                        >
                          {NAV_ICONS.check}
                        </svg>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="rounded-xl bg-gold-50 px-3 py-2.5 transition-all duration-300 ease-out"
                  style={{
                    opacity: gameSelected ? 1 : 0,
                    transform: gameSelected ? "translateY(0)" : "translateY(4px)",
                  }}
                >
                  <p className="text-[10px] font-medium text-forest-900">Skins</p>
                  <p className="mt-0.5 text-[9px] leading-snug text-charcoal-500">
                    Win a hole outright to win its value. Tied holes carry over.
                  </p>
                </div>
              </div>

              {/* Score entry */}
              <div
                className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-300 ease-out"
                style={{
                  opacity: scene === "score" ? 1 : 0,
                  pointerEvents: scene === "score" ? "auto" : "none",
                }}
              >
                <MiniTabs active="score" />
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Hole 7</p>
                  <p className="text-[10px] text-charcoal-500">Par 4 · Handicap 5</p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2.5">
                  <span className="text-[11px] font-medium text-charcoal-700">Mike</span>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-900/10 text-forest-900 transition-transform duration-150 ease-out"
                      style={{ transform: scorePressed === "minus" ? "scale(0.85)" : "scale(1)" }}
                    >
                      <span className="text-xs font-medium leading-none">–</span>
                    </div>
                    <span className="w-4 text-center font-serif text-sm tabular-nums text-forest-900">
                      {scoreValue}
                    </span>
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-900/10 text-forest-900 transition-transform duration-150 ease-out"
                      style={{ transform: scorePressed === "plus" ? "scale(0.85)" : "scale(1)" }}
                    >
                      <span className="text-xs font-medium leading-none">+</span>
                    </div>
                  </div>
                </div>
                <p
                  className="text-[9px] font-medium text-forest-700 transition-opacity duration-300 ease-out"
                  style={{ opacity: scoreSaved ? 1 : 0 }}
                >
                  Saved
                </p>
              </div>

              {/* Add expense */}
              <div
                className="absolute inset-0 space-y-3 px-3.5 py-3.5 transition-opacity duration-300 ease-out"
                style={{
                  opacity: scene === "expense" ? 1 : 0,
                  pointerEvents: scene === "expense" ? "auto" : "none",
                }}
              >
                <p className="text-[10px] font-medium text-charcoal-400">New expense</p>

                <div className="rounded-xl bg-cream-100 px-3 py-2.5">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Amount</p>
                  <p className="mt-0.5 font-serif text-lg text-forest-900">
                    <span className="tabular-nums">${expenseAmountText}</span>
                    <span
                      className="ml-0.5 inline-block h-3.5 w-px translate-y-[1px] bg-forest-900/40 transition-opacity duration-150"
                      style={{ opacity: expenseAmountText.length < EXPENSE_AMOUNT.length ? 1 : 0 }}
                    />
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wide text-charcoal-400">Paid by</p>
                  <div className="flex gap-1.5">
                    {EXPENSE_PAYERS.map((name) => {
                      const isSelected = expensePayerSelected === name;
                      const isPressed = expensePayerPressed === name;
                      return (
                        <div
                          key={name}
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition-colors duration-200 ${
                            isSelected
                              ? "border-forest-900 bg-forest-900 text-cream-50"
                              : "border-cream-200 bg-cream-50 text-charcoal-700"
                          }`}
                          style={{
                            transform: isPressed ? "scale(0.92)" : "scale(1)",
                            transition: "transform 150ms ease-out, background-color 200ms ease-out, color 200ms ease-out, border-color 200ms ease-out",
                          }}
                        >
                          {name}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl bg-cream-100 px-3 py-2.5">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-charcoal-400">For</p>
                  <p className="mt-0.5 min-h-[14px] text-[11px] text-charcoal-700">
                    {expenseForText}
                    <span
                      className="ml-0.5 inline-block h-3 w-px translate-y-[1px] bg-forest-900/40 transition-opacity duration-150"
                      style={{ opacity: expenseForText.length < EXPENSE_FOR.length ? 1 : 0 }}
                    />
                  </p>
                </div>

                <p
                  className="text-[9px] font-medium text-forest-700 transition-opacity duration-300 ease-out"
                  style={{ opacity: expenseSaved ? 1 : 0 }}
                >
                  Saved
                </p>
              </div>

              {/* Centered on the screen's own content area -- between the
                  header and the tab bar, not the whole phone frame -- so
                  the celebration reads as centered on what's actually on
                  screen rather than drifting toward whichever chrome
                  (status bar, nav) happens to be above or below it. */}
              <ScoreCelebration trigger={birdieTrigger} label="Birdie!" />
            </div>

            <div className="flex border-t border-forest-900/[0.08] bg-cream-50/95 px-2 py-1.5">
              {(["home", "plus", "user"] as const).map((icon) => (
                <div key={icon} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-charcoal-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                    {NAV_ICONS[icon]}
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
        <div className="h-1 w-24 rounded-full bg-cream-50/30" />
      </div>
    </div>
  );
}
