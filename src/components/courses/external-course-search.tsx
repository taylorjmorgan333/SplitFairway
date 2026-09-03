"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchExternalCoursesAction,
  searchLocalCoursesAction,
  importExternalCourseAction,
  type ExternalCourseSummary,
  type LocalCourseSummary,
} from "@/actions/course-import";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 200;

type SearchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "rate-limited"; message: string }
  | { phase: "results"; local: LocalCourseSummary[]; external: ExternalCourseSummary[] };

/**
 * Search-first course lookup -- checks this app's own library (already
 * imported or manually-entered courses, no provider request needed) and
 * GolfCourseAPI in parallel, shown above the existing manual "Add a
 * course" form (create-course-form.tsx) rather than instead of it. A
 * course not found here (or if search isn't configured/enabled, or the
 * daily limit is reached) is still just as easy to add by hand below --
 * that fallback never depends on any of this working.
 *
 * Debounces at 200ms and requires 3+ characters before ever calling the
 * server, so this never fires a request per keystroke; a request ref
 * guards against a slow, stale response overwriting a newer one, and
 * every fetch is guarded against overlapping with the previous one so a
 * fast typist (or an impatient extra click) can't fire duplicate
 * requests.
 */
export function ExternalCourseSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ phase: "idle" });
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState({ phase: "idle" });
      return;
    }

    debounceRef.current = setTimeout(() => {
      const thisRequestId = ++requestIdRef.current;
      setState({ phase: "loading" });
      startTransition(async () => {
        const [localResults, externalResult] = await Promise.all([
          searchLocalCoursesAction(trimmed),
          searchExternalCoursesAction(trimmed),
        ]);

        // A newer search started while this one was in flight -- drop
        // this stale response rather than let it clobber fresher results.
        if (thisRequestId !== requestIdRef.current) return;

        if (!externalResult.ok) {
          // Local library search still works even if the provider call
          // failed outright (not configured, disabled, network error) --
          // only show a blocking error if the library search is also empty.
          if (localResults.length > 0) {
            setState({ phase: "results", local: localResults, external: [] });
          } else {
            setState({ phase: "error", message: externalResult.error });
          }
          return;
        }

        if (externalResult.rateLimited) {
          if (localResults.length > 0) {
            setState({ phase: "results", local: localResults, external: [] });
          } else {
            setState({ phase: "rate-limited", message: externalResult.message });
          }
          return;
        }

        setState({ phase: "results", local: localResults, external: externalResult.courses });
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, retryNonce]);

  function handleImport(externalId: string) {
    setImportError(null);
    setImportingId(externalId);
    startTransition(async () => {
      const result = await importExternalCourseAction(externalId);
      setImportingId(null);
      if (result.ok) {
        router.push(`/courses/${result.courseId}`);
      } else {
        setImportError(result.error);
      }
    });
  }

  const showLoading = state.phase === "loading" || (isPending && state.phase !== "results");

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by course or club name (3+ characters)"
        aria-label="Search for a course"
      />

      {importError && <Alert variant="error">{importError}</Alert>}

      {showLoading && <p className="text-sm text-charcoal-400">Searching…</p>}

      {state.phase === "error" && <Alert variant="info">{state.message}</Alert>}
      {state.phase === "rate-limited" && (
        <Alert variant="info">
          {state.message}
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="ml-2 underline underline-offset-2"
          >
            Retry
          </button>
        </Alert>
      )}

      {state.phase === "results" && (
        <div className="space-y-3">
          {state.local.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-charcoal-500">In your library</p>
              <ul className="divide-y divide-charcoal-400/10 overflow-hidden rounded-lg border border-charcoal-400/10">
                {state.local.map((c) => (
                  <li key={c.courseId} className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">{c.name}</p>
                      {(c.city || c.state) && (
                        <p className="truncate text-xs text-charcoal-400">
                          {[c.city, c.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/courses/${c.courseId}`)}
                    >
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.external.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-charcoal-500">From GolfCourseAPI</p>
              <ul className="divide-y divide-charcoal-400/10 overflow-hidden rounded-lg border border-charcoal-400/10">
                {state.external.map((c) => (
                  <li key={c.externalId} className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">
                        {c.courseName && c.courseName !== c.clubName
                          ? `${c.clubName} – ${c.courseName}`
                          : c.clubName}
                      </p>
                      {(c.city || c.state) && (
                        <p className="truncate text-xs text-charcoal-400">
                          {[c.city, c.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={importingId === c.externalId}
                      onClick={() => handleImport(c.externalId)}
                    >
                      {importingId === c.externalId ? "Adding…" : "Add"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.local.length === 0 && state.external.length === 0 && (
            <p className="text-sm text-charcoal-400">
              No matches — try a different name, or add it manually below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
