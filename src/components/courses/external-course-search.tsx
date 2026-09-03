"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchExternalCoursesAction,
  importExternalCourseAction,
  type ExternalCourseSummary,
} from "@/actions/course-import";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * Search-first course lookup against GolfCourseAPI, shown above the
 * existing manual "Add a course" form (create-course-form.tsx) rather
 * than instead of it -- per the user's own choice, course search is a
 * supplement to the user-maintained library, not a replacement for it.
 * A course not found here (or if search isn't configured yet) is still
 * just as easy to add by hand below.
 */
export function ExternalCourseSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalCourseSummary[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setImportError(null);
    startSearch(async () => {
      const result = await searchExternalCoursesAction(query);
      if (result.ok) {
        setResults(result.courses);
      } else {
        setResults(null);
        setSearchError(result.error);
      }
    });
  }

  function handleImport(externalId: string) {
    setImportError(null);
    setImportingId(externalId);
    startSearch(async () => {
      const result = await importExternalCourseAction(externalId);
      setImportingId(null);
      if (result.ok) {
        router.push(`/courses/${result.courseId}`);
      } else {
        setImportError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course or club name"
          aria-label="Search for a course"
        />
        <Button type="submit" variant="outline" disabled={isSearching || query.trim().length < 2}>
          {isSearching ? "Searching…" : "Search"}
        </Button>
      </form>

      {searchError && <Alert variant="info">{searchError}</Alert>}
      {importError && <Alert variant="error">{importError}</Alert>}

      {results && (
        <ul className="divide-y divide-charcoal-400/10 overflow-hidden rounded-lg border border-charcoal-400/10">
          {results.length === 0 && (
            <li className="px-3.5 py-3 text-sm text-charcoal-400">
              No matches — try a different name, or add it manually below.
            </li>
          )}
          {results.map((c) => (
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
      )}
    </div>
  );
}
