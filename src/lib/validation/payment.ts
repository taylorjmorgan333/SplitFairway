import { z } from "zod";

export const PAYMENT_METHOD_VALUES = [
  "venmo",
  "zelle",
  "paypal",
  "cash",
  "check",
  "other",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHOD_VALUES)[number], string> = {
  venmo: "Venmo",
  zelle: "Zelle",
  paypal: "PayPal",
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
