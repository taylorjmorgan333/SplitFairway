import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  searchGolfCourses,
  getGolfCourse,
  GolfCourseApiNotConfiguredError,
  GolfCourseApiRequestError,
} from "./golfcourseapi";

/**
 * Every test here mocks global fetch -- none of these make a real
 * network call, and none consume GolfCourseAPI's real daily request
 * allowance. See golfcourseapi.integration.test.ts for the one optional
 * test that does hit the real API, gated behind an explicit env flag.
 */

const ORIGINAL_ENV = process.env.GOLFCOURSEAPI_KEY;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("golfcourseapi client", () => {
  beforeEach(() => {
    process.env.GOLFCOURSEAPI_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GOLFCOURSEAPI_KEY = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it("throws GolfCourseApiNotConfiguredError when the key is unset", async () => {
    delete process.env.GOLFCOURSEAPI_KEY;
    await expect(searchGolfCourses("pinehurst")).rejects.toBeInstanceOf(
      GolfCourseApiNotConfiguredError,
    );
  });

  it("sends the documented Authorization: Bearer <key> header, never a different format", async () => {
    let capturedHeaders: HeadersInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return jsonResponse({ courses: [] });
      }),
    );

    await searchGolfCourses("pinehurst");

    const headers = new Headers(capturedHeaders);
    expect(headers.get("Authorization")).toBe("Bearer test-key");
  });

  it("calls GET /v1/search with the exact documented query param, url-encoded", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return jsonResponse({ courses: [] });
      }),
    );

    await searchGolfCourses("pine hurst & sons");

    expect(capturedUrl).toBe(
      "https://api.golfcourseapi.com/v1/search?search_query=pine%20hurst%20%26%20sons",
    );
  });

  it("calls GET /v1/courses/{id} for course detail, never POST", async () => {
    let capturedUrl = "";
    let capturedMethod: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method;
        return jsonResponse({
          course: {
            id: "7k2m9qb4",
            club_name: "Club",
            course_name: "Club",
            tees: { male: [], female: [] },
          },
        });
      }),
    );

    await getGolfCourse("7k2m9qb4");

    expect(capturedUrl).toBe("https://api.golfcourseapi.com/v1/courses/7k2m9qb4");
    // fetch defaults to GET when no method is specified -- this asserts
    // this app never sets method: "POST" here, per the explicit
    // instruction not to convert a GET lookup into a POST request.
    expect(capturedMethod).not.toBe("POST");
  });

  it("returns [] when the search response has no courses key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));
    await expect(searchGolfCourses("x")).resolves.toEqual([]);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [422, "validation_error"],
    [429, "rate_limited"],
    [500, "server_error"],
    [503, "server_error"],
  ] as const)("maps HTTP %i to sanitized code %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "nope" }, status)));

    await expect(searchGolfCourses("x")).rejects.toMatchObject({
      code,
      status,
    });
  });

  it("maps a network failure to a network_error, not a crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const err = await searchGolfCourses("x").catch((e) => e);
    expect(err).toBeInstanceOf(GolfCourseApiRequestError);
    expect((err as GolfCourseApiRequestError).code).toBe("network_error");
  });

  it("maps an aborted (timed-out) request to a timeout error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    );

    const promise = searchGolfCourses("x");
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });
    // The client's own internal AbortController fires after
    // REQUEST_TIMEOUT_MS (8s) -- advance fake time past that instead of
    // waiting out a real 8-second timer in the test suite.
    await vi.advanceTimersByTimeAsync(9_000);
    await assertion;
    vi.useRealTimers();
  });

  it("keeps search results and course-detail results as distinct shapes (tees: counts vs. tees: arrays)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/v1/search")) {
          return jsonResponse({
            courses: [
              {
                id: "abc",
                club_name: "Club",
                course_name: "Club",
                tees: { male: 4, female: 3 },
              },
            ],
          });
        }
        return jsonResponse({
          course: {
            id: "abc",
            club_name: "Club",
            course_name: "Club",
            tees: { male: [{ tee_name: "Blue", holes: [] }], female: [] },
          },
        });
      }),
    );

    const results = await searchGolfCourses("club");
    expect(results[0].tees).toEqual({ male: 4, female: 3 });

    const detail = await getGolfCourse("abc");
    expect(Array.isArray(detail.tees.male)).toBe(true);
  });
});
