import { z } from "zod";

export const EXPENSE_CATEGORY_VALUES = [
  "lodging",
  "golf",
  "transportation",
  "food",
  "merchandise",
  "activity",
  "other",
] as const;

export const expenseBaseSchema = z.object({
  title: z.string().trim().min(1, "Give the expense a title").max(160),
  category: z.enum(EXPENSE_CATEGORY_VALUES).default("other"),
  totalAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a dollar amount like 125 or 125.50"),
  vendor: z.string().trim().max(160).optional().or(z.literal("")),
  expenseDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  paidByMemberId: z.string().uuid().optional().or(z.literal("")),
  splitMode: z.enum(["equal", "custom"]).default("equal"),
});

export type ExpenseBaseInput = z.infer<typeof expenseBaseSchema>;
