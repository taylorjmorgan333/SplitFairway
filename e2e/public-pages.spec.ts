import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = [
  { path: "/", heading: "Every round. Every game. Every trip." },
  { path: "/pricing", heading: "Simple pricing built for golf groups" },
  { path: "/faq", heading: "Frequently asked questions" },
  { path: "/signup", heading: "Create your account" },
  { path: "/trip-mode", heading: "Trip Mode" },
  { path: "/contact", heading: "Contact us" },
] as const;

for (const entry of PUBLIC_PAGES) {
  test(`${entry.path} loads with its heading`, async ({ page }) => {
    const response = await page.goto(entry.path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: entry.heading, exact: true })).toBeVisible();
  });
}
