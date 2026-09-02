/**
 * Development-only demo seed.
 *
 * Creates one richly-populated sample trip — 8 golfers, lodging with a
 * custom per-room split, four golf rounds, a rental vehicle, several
 * confirmed and outstanding payments, and one deliberately overdue
 * share — so a local build has something realistic to look at without
 * hand-entering data every time.
 *
 * SAFETY, in layers:
 *
 *  1. Requires ALLOW_DEMO_SEED=true to be set explicitly — just having
 *     the right env vars present is not enough. Nothing runs this
 *     automatically; it is never wired into `npm run build`, a
 *     migration, or any deploy step.
 *  2. Refuses to run when NODE_ENV=production.
 *  3. Refuses to run against a NEXT_PUBLIC_SITE_URL that doesn't look
 *     like localhost — a blunt guard against accidentally pointing this
 *     at a real deployment's env vars.
 *  4. Requires SUPABASE_SERVICE_ROLE_KEY (server-only, never shipped to
 *     the browser — see .env.example) to create the demo auth users,
 *     but every trip/expense/payment mutation after that goes through
 *     the exact same RPCs and RLS policies the real app uses, signed in
 *     as those demo users — this script cannot write anything the real
 *     app's authorization rules wouldn't otherwise allow.
 *
 * Usage (against a LOCAL or disposable dev Supabase project only):
 *   ALLOW_DEMO_SEED=true npx tsx scripts/seed-demo.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { splitEqually, type ExpenseShareCalc } from "../src/lib/split";
import type { Database } from "../src/lib/supabase/database.types";

// --- tiny .env.local loader (no extra dependency) --------------------
function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

const DEMO_PASSWORD = "DemoGolfer!2026";

async function main() {
  // --- guard 1: explicit opt-in --------------------------------------
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    console.error(
      "Refusing to run: set ALLOW_DEMO_SEED=true to confirm this is a development database.\n" +
        "  ALLOW_DEMO_SEED=true npx tsx scripts/seed-demo.ts",
    );
    process.exit(1);
  }

  // --- guard 2: never in a production runtime ------------------------
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run: NODE_ENV=production.");
    process.exit(1);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // --- guard 3: only run against something that looks like localhost -
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteUrl)) {
    console.error(
      `Refusing to run: NEXT_PUBLIC_SITE_URL ("${siteUrl}") doesn't look like a local dev server.\n` +
        "This script is for local/disposable development databases only.",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(1);
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Creating 8 demo golfer accounts…");
  const golferDefs = [
    { email: "demo-captain@example.com", name: "Taylor Rivera" },
    { email: "demo-cocaptain@example.com", name: "Sam Okafor" },
    { email: "demo-golfer3@example.com", name: "Jordan Lee" },
    { email: "demo-golfer4@example.com", name: "Priya Nandan" },
    { email: "demo-golfer5@example.com", name: "Chris Bellweather" },
    // Deliberately absurd — a fixture for testing long-name wrapping in
    // the UI (member rows, balance cards, activity feed), not a typo.
    { email: "demo-golfer6@example.com", name: "Morgan Vasquez-Lindqvist-Alessandro Whitfield III" },
    { email: "demo-golfer7@example.com", name: "Devon Park" },
    { email: "demo-golfer8@example.com", name: "Alex Kim" },
  ];

  const golferIds: string[] = [];
  for (const g of golferDefs) {
    const id = await ensureUser(admin, g.email, g.name);
    golferIds.push(id);
  }
  const [captainId, coCaptainId, ...restIds] = golferIds;
  const [jordanId, priyaId, chrisId, morganId, devonId, alexId] = restIds;

  // A per-user signed-in client for each golfer — every mutation below
  // goes through the same RPCs/RLS as a real signed-in user, not a
  // service-role bypass.
  const clientByGolferId = new Map<string, SupabaseClient<Database>>();
  for (const g of golferDefs) {
    const client = createClient<Database>(url, anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: g.email,
      password: DEMO_PASSWORD,
    });
    if (error || !data.user) {
      throw new Error(`Could not sign in as ${g.email}: ${error?.message}`);
    }
    clientByGolferId.set(data.user.id, client);
  }
  const captain = clientByGolferId.get(captainId)!;

  console.log("Creating trip…");
  const start = addDays(45);
  const end = addDays(48);
  const { data: trip, error: tripError } = await captain.rpc("create_trip", {
    p_name: "Ridgeline Ryder Cup 2026",
    p_destination: "Bandon Dunes, OR",
    p_start_date: start,
    p_end_date: end,
    p_currency: "USD",
    p_description: "Demo trip seeded for local development — not real data.",
  });
  if (tripError || !trip) throw new Error(`create_trip failed: ${tripError?.message}`);
  const tripId = trip.id;

  console.log("Inviting and joining the other 7 golfers…");
  const tripMemberIdByGolferId = new Map<string, string>();
  // The captain's own trip_members row already exists from create_trip().
  {
    const { data } = await captain.from("trip_members").select("id").eq("trip_id", tripId).eq("user_id", captainId).single();
    if (data) tripMemberIdByGolferId.set(captainId, data.id);
  }

  for (const g of golferDefs.slice(1)) {
    const golferId = golferIds[golferDefs.indexOf(g)];
    const { data: invite, error: inviteError } = await captain.rpc("invite_trip_member", {
      p_trip_id: tripId,
      p_email: g.email,
      p_display_name: g.name,
      p_role: "member",
    });
    if (inviteError) throw new Error(`invite_trip_member(${g.email}) failed: ${inviteError.message}`);
    const token = (invite as { token?: string } | null)?.token;
    if (!token) throw new Error(`invite_trip_member(${g.email}) returned no token`);

    const golferClient = clientByGolferId.get(golferId)!;
    const { data: member, error: acceptError } = await golferClient.rpc("accept_trip_invitation", {
      p_token: token,
    });
    if (acceptError) throw new Error(`accept_trip_invitation(${g.email}) failed: ${acceptError.message}`);
    tripMemberIdByGolferId.set(golferId, member.id);
  }

  console.log("Promoting a co-treasurer…");
  const coCaptainMemberId = tripMemberIdByGolferId.get(coCaptainId)!;
  await captain.rpc("set_trip_member_role", { p_trip_member_id: coCaptainMemberId, p_role: "captain" });

  const allMemberIds = golferIds.map((id) => tripMemberIdByGolferId.get(id)!);
  const memberId = (id: string) => tripMemberIdByGolferId.get(id)!;

  // --- Expenses ----------------------------------------------------
  console.log("Adding lodging (custom room split)…");
  // A real-world "custom room allocation": the two who booked the
  // primary suite pay more per person than the three shared standard
  // rooms — this is the one custom-split expense the brief asks for.
  const roomShares: ExpenseShareCalc[] = [
    { tripMemberId: memberId(captainId), amountOwedCents: 45000 },
    { tripMemberId: memberId(coCaptainId), amountOwedCents: 45000 },
    { tripMemberId: memberId(jordanId), amountOwedCents: 35500 },
    { tripMemberId: memberId(priyaId), amountOwedCents: 35500 },
    { tripMemberId: memberId(chrisId), amountOwedCents: 35500 },
    { tripMemberId: memberId(morganId), amountOwedCents: 35500 },
    { tripMemberId: memberId(devonId), amountOwedCents: 35500 },
    { tripMemberId: memberId(alexId), amountOwedCents: 35500 },
  ];
  const lodgingTotal = roomShares.reduce((sum, s) => sum + s.amountOwedCents, 0);
  await createExpense(captain, tripId, {
    title: "Lodging — the Dunes house (custom room split)",
    category: "lodging",
    totalAmountCents: lodgingTotal,
    splitMethod: "custom",
    shares: roomShares,
    paidByMemberId: memberId(captainId),
    expenseDate: addDays(0),
    dueDate: addDays(10),
  });

  console.log("Adding four golf rounds…");
  await createExpense(captain, tripId, {
    title: "Friday — Old Macdonald",
    category: "golf",
    totalAmountCents: 120000,
    splitMethod: "equal",
    shares: splitEqually(120000, allMemberIds),
    paidByMemberId: memberId(coCaptainId),
    expenseDate: start,
    dueDate: addDays(10),
  });

  const sixPlayed = [captainId, coCaptainId, jordanId, priyaId, chrisId, alexId].map(memberId);
  await createExpense(captain, tripId, {
    title: "Saturday AM — Bandon Trails",
    category: "golf",
    totalAmountCents: 90000,
    splitMethod: "selected",
    shares: splitEqually(90000, sixPlayed),
    paidByMemberId: memberId(captainId),
    expenseDate: addDays(46),
    dueDate: addDays(10),
  });

  const fivePlayed = [captainId, jordanId, priyaId, morganId, alexId].map(memberId);
  await createExpense(captain, tripId, {
    title: "Saturday PM — Pacific Dunes",
    category: "golf",
    totalAmountCents: 75000,
    splitMethod: "selected",
    shares: splitEqually(75000, fivePlayed),
    paidByMemberId: memberId(jordanId),
    expenseDate: addDays(46),
    dueDate: addDays(10),
  });

  // Deliberately past-due, and Devon's share is never reimbursed below —
  // this is the "one overdue payment" fixture.
  await createExpense(captain, tripId, {
    title: "Sunday — Bandon Dunes",
    category: "golf",
    totalAmountCents: 128000,
    splitMethod: "equal",
    shares: splitEqually(128000, allMemberIds),
    paidByMemberId: memberId(coCaptainId),
    expenseDate: addDays(48),
    dueDate: addDays(-5),
  });

  console.log("Adding rental vehicle…");
  const vanRiders = [captainId, priyaId, chrisId, alexId].map(memberId);
  await createExpense(captain, tripId, {
    title: "15-passenger van rental",
    category: "transportation",
    totalAmountCents: 64000,
    splitMethod: "selected",
    shares: splitEqually(64000, vanRiders),
    paidByMemberId: memberId(alexId),
    expenseDate: start,
    dueDate: addDays(10),
  });

  // --- Payments ------------------------------------------------------
  console.log("Recording confirmed payments…");
  for (const [payerId, amountCents] of [
    [jordanId, 35500],
    [priyaId, 35500],
    [chrisId, 35500],
  ] as const) {
    await reportAndConfirmPayment(clientByGolferId.get(payerId)!, captain, tripId, {
      payerMemberId: memberId(payerId),
      recipientMemberId: memberId(captainId),
      amountCents,
      method: "venmo",
    });
  }

  console.log("Recording payments still awaiting confirmation…");
  await reportPayment(clientByGolferId.get(morganId)!, tripId, {
    payerMemberId: memberId(morganId),
    recipientMemberId: memberId(coCaptainId),
    amountCents: 20000,
    method: "zelle",
  });
  await reportPayment(clientByGolferId.get(alexId)!, tripId, {
    payerMemberId: memberId(alexId),
    recipientMemberId: memberId(captainId),
    amountCents: 16000,
    method: "cash",
  });

  // Devon (devonId) intentionally never reports a payment — their share
  // of the past-due Sunday round is the demo's "overdue" fixture.

  console.log("\nDone. Demo trip:", `${siteUrl}/trips/${tripId}`);
  console.log("\nDemo accounts (all use the same password — LOCAL DEV ONLY, never real credentials):");
  console.log(`  password: ${DEMO_PASSWORD}`);
  for (const g of golferDefs) console.log(`  ${g.email} — ${g.name}`);
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function ensureUser(admin: SupabaseClient<Database>, email: string, fullName: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!error && data.user) return data.user.id;

  // Re-running the script — look the existing demo user up instead of
  // failing. listUsers() is paginated; demo accounts are few, so one
  // generous page is enough.
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw new Error(`Could not create or find ${email}: ${listError.message}`);
  const found = existing.users.find((u) => u.email === email);
  if (!found) throw new Error(`Could not create ${email}: ${error?.message}`);
  return found.id;
}

async function createExpense(
  captain: SupabaseClient<Database>,
  tripId: string,
  input: {
    title: string;
    category: Database["public"]["Enums"]["expense_category"];
    totalAmountCents: number;
    splitMethod: Database["public"]["Enums"]["split_method"];
    shares: ExpenseShareCalc[];
    paidByMemberId: string;
    expenseDate: string;
    dueDate: string;
  },
) {
  const { error } = await captain.rpc("create_expense_with_shares", {
    p_trip_id: tripId,
    p_title: input.title,
    p_total_amount_cents: input.totalAmountCents,
    p_shares: input.shares.map((s) => ({
      trip_member_id: s.tripMemberId,
      amount_owed_cents: s.amountOwedCents,
    })),
    p_category: input.category,
    p_split_method: input.splitMethod,
    p_paid_by_member_id: input.paidByMemberId,
    p_expense_date: input.expenseDate,
    p_due_date: input.dueDate,
  });
  if (error) throw new Error(`create_expense_with_shares(${input.title}) failed: ${error.message}`);
}

async function reportPayment(
  payer: SupabaseClient<Database>,
  tripId: string,
  input: {
    payerMemberId: string;
    recipientMemberId: string;
    amountCents: number;
    method: Database["public"]["Enums"]["payment_method"];
  },
) {
  const { data: user } = await payer.auth.getUser();
  const { data, error } = await payer
    .from("payments")
    .insert({
      trip_id: tripId,
      payer_member_id: input.payerMemberId,
      recipient_member_id: input.recipientMemberId,
      amount_cents: input.amountCents,
      payment_method: input.method,
      reported_by: user.user!.id,
      status: "reported",
    })
    .select("id")
    .single();
  if (error) throw new Error(`reportPayment failed: ${error.message}`);
  return data.id as string;
}

async function reportAndConfirmPayment(
  payer: SupabaseClient<Database>,
  captain: SupabaseClient<Database>,
  tripId: string,
  input: {
    payerMemberId: string;
    recipientMemberId: string;
    amountCents: number;
    method: Database["public"]["Enums"]["payment_method"];
  },
) {
  const paymentId = await reportPayment(payer, tripId, input);
  const { error } = await captain.rpc("confirm_payment", { p_payment_id: paymentId });
  if (error) throw new Error(`confirm_payment failed: ${error.message}`);
}

main().catch((err) => {
  console.error("\nDemo seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
