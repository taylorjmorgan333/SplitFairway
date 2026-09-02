import { z } from "zod";

const TRIP_STATUS_VALUES = ["planning", "active", "completed", "cancelled"] as const;

export const createTripSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(120),
  destination: z.string().trim().max(120).optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(120),
  destination: z.string().trim().max(120).optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(TRIP_STATUS_VALUES),
});

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  displayName: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(["captain", "member"]).default("member"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Ownership transfer is irreversible-feeling enough (it hands over the
// trip's primary administrative designation) that the form requires
// typing a literal confirmation word rather than just clicking a
// button — the explicit confirmation step the spec calls for. The
// server independently re-checks ownership regardless of this value.
export const transferOwnershipSchema = z.object({
  newOwnerTripMemberId: z.string().uuid("Choose who should become the owner"),
  confirmation: z.literal("TRANSFER", {
    errorMap: () => ({ message: 'Type TRANSFER (in capital letters) to confirm' }),
  }),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
