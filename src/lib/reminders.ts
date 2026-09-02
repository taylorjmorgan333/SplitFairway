import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Pure reminder-message builder — no I/O, no database, no email
 * sending. Given a tone and a context describing what the reminder is
 * about, it returns copy ready to email or copy-paste as a text
 * message. Kept pure and side-effect-free so it's cheap to test
 * exhaustively (see reminders.test.ts), especially the "funny" tone,
 * which must never read as insulting.
 */

export type ReminderTone = "friendly" | "direct" | "funny";
export const REMINDER_TONES: ReminderTone[] = ["friendly", "direct", "funny"];

export type OverdueReminderContext = {
  kind: "overdue";
  tripName: string;
  recipientName: string;
  amountCents: number;
  dueDate: string;
};

export type DueSoonReminderContext = {
  kind: "due_soon";
  tripName: string;
  recipientName: string;
  amountCents: number;
  dueDate: string;
};

export type ConfirmPaymentReminderContext = {
  kind: "confirm_payment";
  tripName: string;
  recipientName: string;
  payerName: string;
  amountCents: number;
  paymentMethodLabel: string;
};

export type InvitationReminderContext = {
  kind: "invitation";
  tripName: string;
  recipientName: string;
  daysUntilExpiry: number;
};

export type ReminderContext =
  | OverdueReminderContext
  | DueSoonReminderContext
  | ConfirmPaymentReminderContext
  | InvitationReminderContext;

export type ReminderMessage = {
  subject: string;
  emailBody: string;
  smsText: string;
};

const PAYMENT_DISCLAIMER =
  "Golf Trip Treasurer tracks payments but does not transfer funds. Complete the payment using the trip captain's instructions, then record it here.";

function overdueMessage(tone: ReminderTone, ctx: OverdueReminderContext): ReminderMessage {
  const amount = formatCurrency(ctx.amountCents);
  const due = formatDate(ctx.dueDate);

  if (tone === "direct") {
    return {
      subject: `Overdue: ${amount} for ${ctx.tripName}`,
      emailBody: `Hi ${ctx.recipientName},\n\nYour balance of ${amount} for ${ctx.tripName} was due ${due} and is still outstanding. Please take care of it as soon as you can.\n\n${PAYMENT_DISCLAIMER}`,
      smsText: `${ctx.tripName}: you still owe ${amount} (was due ${due}). Please settle up soon.`,
    };
  }

  if (tone === "funny") {
    return {
      subject: "Your golf tab called — it misses you ⛳",
      emailBody: `Hey ${ctx.recipientName},\n\nYour friendly neighborhood scoreboard here. ${amount} for ${ctx.tripName} was due ${due} and it's still out wandering the fairway looking for you. No three-putt jokes, just a nudge — send it in whenever you get a swing at it.\n\n${PAYMENT_DISCLAIMER}`,
      smsText: `${ctx.tripName}: ${amount} is still out on the course looking for you (was due ${due}). Bring it home when you can! ⛳`,
    };
  }

  return {
    subject: `Friendly reminder: ${amount} for ${ctx.tripName}`,
    emailBody: `Hi ${ctx.recipientName},\n\nJust a friendly nudge that your balance of ${amount} for ${ctx.tripName} was due ${due}. Whenever you get a chance to settle up, that would be great — thanks!\n\n${PAYMENT_DISCLAIMER}`,
    smsText: `Hi! Friendly reminder that you owe ${amount} for ${ctx.tripName} (was due ${due}). Thanks!`,
  };
}

function dueSoonMessage(tone: ReminderTone, ctx: DueSoonReminderContext): ReminderMessage {
  const amount = formatCurrency(ctx.amountCents);
  const due = formatDate(ctx.dueDate);

  if (tone === "direct") {
    return {
      subject: `Due soon: ${amount} for ${ctx.tripName} (${due})`,
      emailBody: `Hi ${ctx.recipientName},\n\nYour balance of ${amount} for ${ctx.tripName} is due ${due}. Please make sure it's paid by then.\n\n${PAYMENT_DISCLAIMER}`,
      smsText: `${ctx.tripName}: ${amount} is due ${due}. Please pay by then.`,
    };
  }

  if (tone === "funny") {
    return {
      subject: "Heads up — payment tee time approaching ⛳",
      emailBody: `Hey ${ctx.recipientName},\n\nQuick heads up before it's out of bounds: ${amount} for ${ctx.tripName} is due ${due}. Get ahead of it now and skip the awkward reminder text later.\n\n${PAYMENT_DISCLAIMER}`,
      smsText: `${ctx.tripName}: ${amount} is due ${due} — get it in before the buzzer! ⛳`,
    };
  }

  return {
    subject: `Coming up: ${amount} for ${ctx.tripName}`,
    emailBody: `Hi ${ctx.recipientName},\n\nJust a heads up that your balance of ${amount} for ${ctx.tripName} is due ${due}. Thanks for staying on top of it!\n\n${PAYMENT_DISCLAIMER}`,
    smsText: `Hi! Heads up that ${amount} for ${ctx.tripName} is due ${due}. Thanks!`,
  };
}

function confirmPaymentMessage(
  tone: ReminderTone,
  ctx: ConfirmPaymentReminderContext,
): ReminderMessage {
  const amount = formatCurrency(ctx.amountCents);

  if (tone === "direct") {
    return {
      subject: `Action needed: confirm ${ctx.payerName}'s payment`,
      emailBody: `Hi ${ctx.recipientName},\n\n${ctx.payerName} reported paying you ${amount} via ${ctx.paymentMethodLabel} for ${ctx.tripName}. Please confirm or reject it in the app so balances stay accurate.\n\n${PAYMENT_DISCLAIMER}`,
      smsText: `${ctx.payerName} reported a ${amount} payment for ${ctx.tripName} — please confirm it in the app.`,
    };
  }

  if (tone === "funny") {
    return {
      subject: "A payment is stuck in the clubhouse waiting on your signature",
      emailBody: `Hey ${ctx.recipientName},\n\n${ctx.payerName} says they sent you ${amount} via ${ctx.paymentMethodLabel} for ${ctx.tripName}, and it's sitting in the clubhouse waiting for your nod. One tap to confirm (or reject) and it's off both your plates.\n\n${PAYMENT_DISCLAIMER}`,
      smsText: `${ctx.payerName}'s ${amount} payment for ${ctx.tripName} is waiting on your ok — one tap in the app!`,
    };
  }

  return {
    subject: `Please confirm ${ctx.payerName}'s payment`,
    emailBody: `Hi ${ctx.recipientName},\n\n${ctx.payerName} reported paying you ${amount} via ${ctx.paymentMethodLabel} for ${ctx.tripName}. When you get a moment, could you confirm it in the app? Thanks!\n\n${PAYMENT_DISCLAIMER}`,
    smsText: `Could you confirm ${ctx.payerName}'s ${amount} payment for ${ctx.tripName} when you get a chance? Thanks!`,
  };
}

function invitationMessage(tone: ReminderTone, ctx: InvitationReminderContext): ReminderMessage {
  const daysText =
    ctx.daysUntilExpiry <= 1 ? "expires very soon" : `expires in ${ctx.daysUntilExpiry} days`;

  if (tone === "direct") {
    return {
      subject: `Your invitation to ${ctx.tripName} ${daysText}`,
      emailBody: `Hi ${ctx.recipientName},\n\nYour invitation to join ${ctx.tripName} ${daysText}. Please accept it soon, or let the trip captain know if you need a new link.`,
      smsText: `Your invite to ${ctx.tripName} ${daysText} — accept it soon!`,
    };
  }

  if (tone === "funny") {
    return {
      subject: "Your tee time invite is getting a little stale 🌱",
      emailBody: `Hey ${ctx.recipientName},\n\nJust checking — your invitation to ${ctx.tripName} ${daysText}. We'd love to have you on the course; check your email for the invite, or give a shout if it's gone missing and we'll fire off a fresh one.`,
      smsText: `Your invite to ${ctx.tripName} ${daysText} — don't leave us hanging on the tee box! ⛳`,
    };
  }

  return {
    subject: `Reminder: join ${ctx.tripName}`,
    emailBody: `Hi ${ctx.recipientName},\n\nJust a friendly reminder that your invitation to join ${ctx.tripName} ${daysText}. We'd love to have you — check your email for the invite, or ask the trip captain to resend it if you can't find it.`,
    smsText: `Friendly reminder: your invite to ${ctx.tripName} ${daysText}!`,
  };
}

export function buildReminderMessage(
  tone: ReminderTone,
  context: ReminderContext,
): ReminderMessage {
  switch (context.kind) {
    case "overdue":
      return overdueMessage(tone, context);
    case "due_soon":
      return dueSoonMessage(tone, context);
    case "confirm_payment":
      return confirmPaymentMessage(tone, context);
    case "invitation":
      return invitationMessage(tone, context);
  }
}
