/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Loud, hard-to-miss build-time reminder — not a build failure, since a
// preview/staging build shouldn't be blocked by it, but a production
// build silently shipping a "support email not configured" notice to
// real users is exactly the kind of thing that should show up in the
// Vercel build log, not just be discoverable by clicking around later.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SUPPORT_EMAIL) {
  console.warn(
    "\n⚠️  NEXT_PUBLIC_SUPPORT_EMAIL is not set. The Contact and data-deletion pages will " +
      "show a visible \"support email not configured\" notice instead of a real address. " +
      "Set it in your production environment before real users see these pages.\n",
  );
}

export default nextConfig;
