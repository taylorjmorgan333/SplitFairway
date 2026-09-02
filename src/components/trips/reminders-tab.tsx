"use client";

import { useState, useTransition } from "react";
import { sendReminderAction } from "@/actions/reminders";
import { buildReminderMessage, REMINDER_TONES, type ReminderContext, type ReminderTone } from "@/lib/reminders";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type OverdueCandidate = {
  memberId: string;
  displayName: string;
  email: string;
  amountCents: number;
  dueDate: string;
};

export type DueSoonCandidate = OverdueCandidate;

export type ConfirmCandidate = {
  paymentId: string;
  payerName: string;
  amountCents: number;
  paymentMethodLabel: string;
  recipientMemberId: string | null;
  recipientName: string;
  recipientEmail: string;
};

export type InvitationCandidate = {
  tripMemberId: string;
  displayName: string;
  email: string;
  daysUntilExpiry: number;
};

const TONE_LABELS: Record<ReminderTone, string> = {
  friendly: "Friendly",
  direct: "Direct",
  funny: "Funny",
};

export function RemindersTab({
  tripId,
  tripName,
  overdue,
  dueSoon,
  awaitingConfirmation,
  invitations,
}: {
  tripId: string;
  tripName: string;
  overdue: OverdueCandidate[];
  dueSoon: DueSoonCandidate[];
  awaitingConfirmation: ConfirmCandidate[];
  invitations: InvitationCandidate[];
}) {
  const [tone, setTone] = useState<ReminderTone>("friendly");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reminder tone</CardTitle>
          <CardDescription>
            Applies to every reminder below. Emails send automatically when a provider is
            configured; otherwise they&apos;re logged as a preview and you can copy the text
            yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {REMINDER_TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={
                  tone === t
                    ? "rounded-full bg-forest-800 px-4 py-1.5 text-sm font-medium text-cream-50"
                    : "rounded-full border border-forest-900/15 px-4 py-1.5 text-sm text-charcoal-500 hover:bg-forest-50"
                }
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ReminderSection
        title="Overdue members"
        description="Their balance was due and is still unpaid."
        empty="No one is overdue right now."
      >
        {overdue.map((c) => (
          <ReminderRow
            key={`overdue-${c.memberId}`}
            tripId={tripId}
            tone={tone}
            recipientEmail={c.email}
            targetMemberId={c.memberId}
            headline={`${c.displayName} — ${formatCurrency(c.amountCents)}, was due ${formatDate(c.dueDate)}`}
            context={{
              kind: "overdue",
              tripName,
              recipientName: c.displayName,
              amountCents: c.amountCents,
              dueDate: c.dueDate,
            }}
          />
        ))}
      </ReminderSection>

      <ReminderSection
        title="Due in the next 7 days"
        description="Coming up soon — a gentle heads-up before it's overdue."
        empty="Nothing due in the next week."
      >
        {dueSoon.map((c) => (
          <ReminderRow
            key={`due-soon-${c.memberId}`}
            tripId={tripId}
            tone={tone}
            recipientEmail={c.email}
            targetMemberId={c.memberId}
            headline={`${c.displayName} — ${formatCurrency(c.amountCents)}, due ${formatDate(c.dueDate)}`}
            context={{
              kind: "due_soon",
              tripName,
              recipientName: c.displayName,
              amountCents: c.amountCents,
              dueDate: c.dueDate,
            }}
          />
        ))}
      </ReminderSection>

      <ReminderSection
        title="Reported payments awaiting confirmation"
        description="Nudge whoever needs to confirm or reject these."
        empty="Nothing waiting on confirmation."
      >
        {awaitingConfirmation.map((c) => (
          <ReminderRow
            key={`confirm-${c.paymentId}`}
            tripId={tripId}
            tone={tone}
            recipientEmail={c.recipientEmail}
            targetMemberId={c.recipientMemberId}
            headline={`${c.payerName} → ${c.recipientName} — ${formatCurrency(c.amountCents)} via ${c.paymentMethodLabel}`}
            context={{
              kind: "confirm_payment",
              tripName,
              recipientName: c.recipientName,
              payerName: c.payerName,
              amountCents: c.amountCents,
              paymentMethodLabel: c.paymentMethodLabel,
            }}
          />
        ))}
      </ReminderSection>

      <ReminderSection
        title="Invitation reminders"
        description="Invited golfers who haven't accepted yet."
        empty="No pending invitations."
      >
        {invitations.map((c) => (
          <ReminderRow
            key={`invite-${c.tripMemberId}`}
            tripId={tripId}
            tone={tone}
            recipientEmail={c.email}
            targetMemberId={c.tripMemberId}
            headline={`${c.displayName} — invite expires in ${c.daysUntilExpiry} day${c.daysUntilExpiry === 1 ? "" : "s"}`}
            context={{
              kind: "invitation",
              tripName,
              recipientName: c.displayName,
              daysUntilExpiry: c.daysUntilExpiry,
            }}
          />
        ))}
      </ReminderSection>
    </div>
  );
}

function ReminderSection({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <ul className="divide-y divide-forest-900/[0.06]">{children}</ul>
        ) : (
          <p className="text-sm text-charcoal-500">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReminderRow({
  tripId,
  tone,
  recipientEmail,
  targetMemberId,
  headline,
  context,
}: {
  tripId: string;
  tone: ReminderTone;
  recipientEmail: string;
  targetMemberId: string | null;
  headline: string;
  context: ReminderContext;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const message = buildReminderMessage(tone, context);

  function handleSend() {
    setFeedback(null);
    startTransition(async () => {
      const result = await sendReminderAction(tripId, tone, context, recipientEmail, targetMemberId);
      setFeedback(result.message);
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.smsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback("Couldn't copy automatically — select and copy the text manually.");
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-charcoal">{headline}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide preview" : "Preview"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy text"}
          </Button>
          <Button size="sm" disabled={isPending} onClick={handleSend}>
            {isPending ? "Sending…" : "Send email"}
          </Button>
        </div>
      </div>

      {feedback && <p className="mt-2 text-xs text-charcoal-500">{feedback}</p>}

      {expanded && (
        <div className="mt-3 space-y-2 rounded-lg bg-cream-100 p-3 text-xs text-charcoal-600">
          <p>
            <Badge variant="neutral">Subject</Badge> <span className="ml-1">{message.subject}</span>
          </p>
          <p className="whitespace-pre-line">{message.emailBody}</p>
          <p>
            <Badge variant="forest">Text message</Badge>{" "}
            <span className="ml-1">{message.smsText}</span>
          </p>
        </div>
      )}
    </li>
  );
}
