import type { Metadata } from "next";
import { Mail, MessageSquarePlus } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-14 sm:py-20">
        <Container className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl">Contact us</h1>
          <p className="mt-3 text-sm leading-relaxed text-charcoal-500">
            SplitFairway is in private beta — we&apos;d genuinely like to hear from you,
            whether it&apos;s a bug, a confusing screen, or a feature you wish existed.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <Mail className="h-5 w-5 text-forest-700" aria-hidden="true" />
                <CardTitle className="mt-2">Email</CardTitle>
                <CardDescription>For account issues, questions, or anything else.</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href="mailto:support@golftriptreasurer.example"
                  className="text-sm font-medium text-forest-800 underline"
                >
                  support@golftriptreasurer.example
                </a>
                <p className="mt-2 text-xs text-charcoal-400">
                  Placeholder address for this beta — replace with a real monitored inbox before
                  launch.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MessageSquarePlus className="h-5 w-5 text-forest-700" aria-hidden="true" />
                <CardTitle className="mt-2">In-app feedback</CardTitle>
                <CardDescription>The fastest way to reach us while you&apos;re signed in.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-charcoal-600">
                  Use the <strong>Feedback</strong> button in the corner of any page once
                  you&apos;re signed in — it goes straight to the team, with the page you were on
                  attached automatically.
                </p>
              </CardContent>
            </Card>
          </div>

          <p className="mt-8 text-xs text-charcoal-400">
            Want your account or data removed instead? See our{" "}
            <a href="/legal/data-deletion" className="text-forest-800 underline">
              data deletion page
            </a>
            .
          </p>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
