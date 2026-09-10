import { z } from "zod";

export const PAYMENT_METHOD_VALUES = [
  "venmo",
  "cashapp",
  "zelle",
  "paypal",
  "apple_pay",
  "cash",
  "check",
  "other",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHOD_VALUES)[number], string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
  cash: "Cash",
  check: "Check",
  other: "Other",
};

export const reportPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a dollar amount like 50 or 50.25"),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
  recipientMemberId: z.string().uuid("Select who you paid"),
  paidAt: z.string().optional().or(z.literal("")),
  referenceNote: z.string().trim().max(280).optional().or(z.literal("")),
});

export type ReportPaymentInput = z.infer<typeof reportPaymentSchema>;

// A golfer's own "how to pay me" info -- shown next to them on the
// Golfers tab so trip mates know where to send money without asking.
// Distinct from reportPaymentSchema above: that records how a specific
// payment was actually made; this is just a standing preference. Both
// fields are optional and independent -- a method with no handle yet
// (e.g. "Venmo", still figuring out the username) is a valid save.
export const memberPaymentInfoSchema = z.object({
  preferredPaymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional().or(z.literal("")),
  paymentHandle: z.string().trim().max(120).optional().or(z.literal("")),
});

export type MemberPaymentInfoInput = z.infer<typeof memberPaymentInfoSchema>;
