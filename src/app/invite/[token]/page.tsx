import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { InviteResponse } from "@/components/invitations/invite-response";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvitationPreview } from "@/lib/invitations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "You're invited" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // get_invitation_preview() is granted to anon — an invited golfer
  // hasn't signed in yet when they open this link — and is
  // deliberately minimal for anything but a still-actionable
  // ("pending") invitation, so a stale/guessed/revoked token teaches a
  // visitor as little as possible.
  const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token });
  const preview = (error ? { status: "not_found" } : data) as InvitationPreview;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = `/invite/${token}`;

  return (
    <div className="relative flex min-h-screen flex-col bg-forest-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-contour-lines opacity-40"
      />
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-16">
        <Link href="/" className="mb-10" aria-label="Golf Trip Treasurer home">
          <Logo variant="light" />
        </Link>

        <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>
                {preview.status === "pending" ? "You're invited to a golf trip" : "Invitation"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preview.status === "not_found" && (
                <p className="text-sm text-charcoal-500">
                  This invitation link isn&apos;t valid. Double-check the link, or ask the trip
                  captain to send a new one.
                </p>
              )}

              {preview.status === "revoked" && (
                <p className="text-sm text-charcoal-500">
                  This invitation to <strong>{preview.trip_name}</strong> has been revoked by the
                  trip captain. Ask them to send a new one if this was a mistake.
                </p>
              )}

              {preview.status === "declined" && (
                <p className="text-sm text-charcoal-500">
                  This invitation to <strong>{preview.trip_name}</strong> was already declined.
                </p>
              )}

              {preview.status === "expired" && (
                <p className="text-sm text-charcoal-500">
                  This invitation to <strong>{preview.trip_name}</strong> has expired. Ask the trip
                  captain to resend it.
                </p>
              )}

              {preview.status === "accepted" && (
                <div className="space-y-4">
                  <p className="text-sm text-charcoal-500">
                    You&apos;ve already accepted this invitation to{" "}
                    <strong>{preview.trip_name}</strong>.
                  </p>
                  {user ? (
                    <ButtonLink href={`/trips/${preview.trip_id}`}>Go to the trip</ButtonLink>
                  ) : (
                    <ButtonLink href={`/login?next=${encodeURIComponent(`/trips/${preview.trip_id}`)}`}>
                      Log in to view it
                    </ButtonLink>
                  )}
                </div>
              )}

              {preview.status === "pending" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm text-charcoal-500">
                      {preview.captain_name} invited you to join
                    </p>
                    <p className="mt-0.5 text-xl text-forest-900">{preview.trip_name}</p>
                  </div>

                  <dl className="grid gap-3 rounded-lg bg-cream-100 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
                        Destination
                      </dt>
                      <dd className="mt-0.5 text-charcoal">{preview.destination || "TBD"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
                        Dates
                      </dt>
                      <dd className="mt-0.5 text-charcoal">
                        {preview.start_date
                          ? `${formatDate(preview.start_date)}${preview.end_date ? ` – ${formatDate(preview.end_date)}` : ""}`
                          : "TBD"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
                        Estimated cost per golfer
                      </dt>
                      <dd className="mt-0.5 text-charcoal">
                        {formatCurrency(preview.estimated_cost_cents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-charcoal-400">
                        Trip captain
                      </dt>
                      <dd className="mt-0.5 text-charcoal">{preview.captain_name}</dd>
                    </div>
                  </dl>

                  <p className="text-xs text-charcoal-400">
                    This estimate is a rough split of expenses logged so far — it will change as
                    the trip is planned.
                  </p>

                  {user && user.email?.toLowerCase() === preview.invitee_email.toLowerCase() ? (
                    <InviteResponse token={token} />
                  ) : user ? (
                    <p className="text-sm text-charcoal-500">
                      This invitation was sent to <strong>{preview.invitee_email}</strong>, but
                      you&apos;re signed in as <strong>{user.email}</strong>. Log out and sign in
                      with the invited email address to accept it.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <ButtonLink href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                        Sign up to accept
                      </ButtonLink>
                      <ButtonLink href={`/login?next=${encodeURIComponent(nextPath)}`} variant="outline">
                        I already have an account
                      </ButtonLink>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <CardDescription className="mt-4 text-center text-cream-100/70">
            Golf Trip Treasurer tracks who owes what — it never moves any money.
          </CardDescription>
        </div>
      </div>
    </div>
  );
}
