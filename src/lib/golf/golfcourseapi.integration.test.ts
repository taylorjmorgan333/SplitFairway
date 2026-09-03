import { describe, expect, it } from "vitest";
import { searchGolfCourses, getGolfCourse } from "./golfcourseapi";

/**
 * The one OPTIONAL integration test that hits the real GolfCourseAPI --
 * everything else in this test suite mocks fetch and never touches the
 * network or the real daily request allowance. This test is SKIPPED by
 * default and only runs when both of the following are true, since it
 * spends two real requests against a 50/day free-tier quota:
 *
 *   RUN_GOLFCOURSEAPI_INTEGRATION_TEST=true
 *   GOLFCOURSEAPI_KEY=<a real key>
 *
 * Run it explicitly with:
 *   RUN_GOLFCOURSEAPI_INTEGRATION_TEST=true GOLFCOURSEAPI_KEY=... npx vitest run src/lib/golf/golfcourseapi.integration.test.ts
 */
const shouldRun =
  process.env.RUN_GOLFCOURSEAPI_INTEGRATION_TEST === "true" && Boolean(process.env.GOLFCOURSEAPI_KEY);

describe.skipIf(!shouldRun)("golfcourseapi (real API integration)", () => {
  it("searches and fetches a real course from the live API", async () => {
    const results = await searchGolfCourses("pinehurst");
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      const detail = await getGolfCourse(results[0].id);
      expect(detail.id).toBe(results[0].id);
      expect(detail.tees).toBeDefined();
    }
  }, 20_000);
});
