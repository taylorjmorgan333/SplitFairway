import { describe, expect, it } from "vitest";
import { buildReminderMessage, REMINDER_TONES, type ReminderContext } from "./reminders";
import { formatCurrency, formatDate } from "./utils";

// Words that would make a "funny" reminder read as mean-spirited
// rather than playful. The spec explicitly requires the funny tone
// stay non-insulting by default, so this list is the automated check
// for that — it should never need a human to eyeball copy changes.
const INSULT_WORDS = [
  "idiot",
  "stupid",
  "dumb",
  "pathetic",
  "loser",
  "deadbeat",
  "cheap",
  "cheapskate",
  "lazy",
  "worthless",
  "shame",
  "shameful",
  "embarrass",
  "pay up",
  "or else",
  "irresponsible",
  "freeload",
  "moron",
  "idiotic",
];

const contexts: { name: string; context: ReminderContext }[] = [
  {
    name: "overdue",
    context: {
      kind: "overdue",
      tripName: "Pebble Beach 2026",
      recipientName: "Chris",
      amountCents: 30000,
      dueDate: "2026-08-01",
    },
  },
  {
    name: "due_soon",
    context: {
      kind: "due_soon",
      tripName: "Pebble Beach 2026",
      recipientName: "Mike",
      amountCents: 50000,
      dueDate: "2026-09-10",
    },
  },
  {
    name: "confirm_payment",
    context: {
      kind: "confirm_payment",
      tripName: "Pebble Beach 2026",
      recipientName: "Taylor",
      payerName: "Mike",
      amountCents: 50000,
      paymentMethodLabel: "Venmo",
    },
  },
  {
    name: "invitation",
    context: {
      kind: "invitation",
      tripName: "Pebble Beach 2026",
      recipientName: "Sam",
      daysUntilExpiry: 3,
    },
  },
];

describe("buildReminderMessage", () => {
  for (const { name, context } of contexts) {
    for (const tone of REMINDER_TONES) {
      it(`produces a non-empty subject, email body, and SMS text for ${name}/${tone}`, () => {
        const message = buildReminderMessage(tone, context);
        expect(message.subject.trim().length).toBeGreaterThan(0);
        expect(message.emailBody.trim().length).toBeGreaterThan(0);
        expect(message.smsText.trim().length).toBeGreaterThan(0);
      });

      it(`mentions the recipient and trip name for ${name}/${tone}`, () => {
        const message = buildReminderMessage(tone, context);
        const combined = `${message.subject} ${message.emailBody} ${message.smsText}`;
        expect(combined).toContain(context.tripName);
      });
    }
  }

  it("includes the exact required payment disclaimer in financial reminder emails", () => {
    const disclaimer =
      "SplitFairway tracks payments but does not transfer funds. Complete the payment using the trip captain's instructions, then record it here.";
    for (const kind of ["overdue", "due_soon", "confirm_payment"] as const) {
      const context = contexts.find((c) => c.name === kind)!.context;
      for (const tone of REMINDER_TONES) {
        const message = buildReminderMessage(tone, context);
        expect(message.emailBody).toContain(disclaimer);
      }
    }
  });

  it("mentions the correctly formatted dollar amount for amount-bearing reminders", () => {
    for (const kind of ["overdue", "due_soon", "confirm_payment"] as const) {
      const context = contexts.find((c) => c.name === kind)!.context as Extract<
        ReminderContext,
        { amountCents: number }
      >;
      const amount = formatCurrency(context.amountCents);
      for (const tone of REMINDER_TONES) {
        const message = buildReminderMessage(tone, context);
        expect(`${message.subject} ${message.emailBody} ${message.smsText}`).toContain(amount);
      }
    }
  });

  it("mentions the due date for overdue and due-soon reminders", () => {
    for (const kind of ["overdue", "due_soon"] as const) {
      const context = contexts.find((c) => c.name === kind)!.context as Extract<
        ReminderContext,
        { dueDate: string }
      >;
      const due = formatDate(context.dueDate);
      for (const tone of REMINDER_TONES) {
        const message = buildReminderMessage(tone, context);
        expect(`${message.subject} ${message.emailBody} ${message.smsText}`).toContain(due);
      }
    }
  });

  it("never uses insulting language in the funny tone, for any reminder kind", () => {
    for (const { context } of contexts) {
      const message = buildReminderMessage("funny", context);
      const combined = `${message.subject} ${message.emailBody} ${message.smsText}`.toLowerCase();
      for (const word of INSULT_WORDS) {
        expect(combined).not.toContain(word);
      }
    }
  });

  it("keeps distinct copy across all three tones for the same reminder", () => {
    for (const { context } of contexts) {
      const bodies = REMINDER_TONES.map((tone) => buildReminderMessage(tone, context).emailBody);
      expect(new Set(bodies).size).toBe(REMINDER_TONES.length);
    }
  });
});
