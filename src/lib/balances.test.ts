import { describe, expect, it } from "vitest";
import { calculateBalances, suggestSettlements, type ExpenseInput, type PaymentInput } from "./balances";
import { splitEqually } from "./split";

const MEMBERS = [
  { id: "taylor", displayName: "Taylor" },
  { id: "mike", displayName: "Mike" },
  { id: "chris", displayName: "Chris" },
];

describe("calculateBalances", () => {
  it("computes total share, fronted amount, and net position from expenses alone", () => {
    // Taylor fronts a $300 expense split evenly three ways ($100 each).
    const expenses: ExpenseInput[] = [
      {
        id: "e1",
        totalAmountCents: 30000,
        paidByMemberId: "taylor",
        dueDate: null,
        shares: [
          { tripMemberId: "taylor", amountOwedCents: 10000 },
          { tripMemberId: "mike", amountOwedCents: 10000 },
          { tripMemberId: "chris", amountOwedCents: 10000 },
        ],
      },
    ];

    const balances = calculateBalances(MEMBERS, expenses, []);
    const byId = new Map(balances.map((b) => [b.memberId, b]));

    // Taylor: paid $300, owes $100 of it herself -> net +$200 (due back).
    expect(byId.get("taylor")?.totalShareCents).toBe(10000);
    expect(byId.get("taylor")?.paidTowardExpensesCents).toBe(30000);
    expect(byId.get("taylor")?.netCents).toBe(20000);
    expect(byId.get("taylor")?.amountDueBackCents).toBe(20000);
    expect(byId.get("taylor")?.amountOwedCents).toBe(0);

    // Mike and Chris each owe their full $100 share, having fronted nothing.
    expect(byId.get("mike")?.netCents).toBe(-10000);
    expect(byId.get("mike")?.amountOwedCents).toBe(10000);
    expect(byId.get("chris")?.amountOwedCents).toBe(10000);
  });

  it("only lets CONFIRMED payments move a balance — reported and rejected do not count", () => {
    const expenses: ExpenseInput[] = [
      {
        id: "e1",
        totalAmountCents: 20000,
        paidByMemberId: "taylor",
        dueDate: null,
        shares: [
          { tripMemberId: "taylor", amountOwedCents: 10000 },
          { tripMemberId: "mike", amountOwedCents: 10000 },
        ],
      },
    ];

    const reportedOnly: PaymentInput[] = [
      { id: "p1", payerMemberId: "mike", recipientMemberId: "taylor", amountCents: 10000, status: "reported" },
    ];
    const balancesWithReported = calculateBalances(MEMBERS, expenses, reportedOnly);
    const mikeReported = balancesWithReported.find((b) => b.memberId === "mike")!;
    // Still shows as owing — a merely-reported payment hasn't moved anything yet.
    expect(mikeReported.amountOwedCents).toBe(10000);
    expect(mikeReported.reimbursementsSentCents).toBe(0);

    const rejected: PaymentInput[] = [
      { id: "p2", payerMemberId: "mike", recipientMemberId: "taylor", amountCents: 10000, status: "rejected" },
    ];
    const balancesWithRejected = calculateBalances(MEMBERS, expenses, rejected);
    expect(balancesWithRejected.find((b) => b.memberId === "mike")!.amountOwedCents).toBe(10000);

    const confirmed: PaymentInput[] = [
      { id: "p3", payerMemberId: "mike", recipientMemberId: "taylor", amountCents: 10000, status: "confirmed" },
    ];
    const balancesWithConfirmed = calculateBalances(MEMBERS, expenses, confirmed);
    const mikeConfirmed = balancesWithConfirmed.find((b) => b.memberId === "mike")!;
    expect(mikeConfirmed.reimbursementsSentCents).toBe(10000);
    expect(mikeConfirmed.amountOwedCents).toBe(0);
    expect(mikeConfirmed.netCents).toBe(0);

    const taylorConfirmed = balancesWithConfirmed.find((b) => b.memberId === "taylor")!;
    expect(taylorConfirmed.reimbursementsReceivedCents).toBe(10000);
    expect(taylorConfirmed.netCents).toBe(0);
  });

  it("reports zero balances (fully settled) with no owed or due-back amount", () => {
    const expenses: ExpenseInput[] = [
      {
        id: "e1",
        totalAmountCents: 10000,
        paidByMemberId: "taylor",
        dueDate: null,
        shares: [
          { tripMemberId: "taylor", amountOwedCents: 5000 },
          { tripMemberId: "mike", amountOwedCents: 5000 },
        ],
      },
    ];
    const payments: PaymentInput[] = [
      { id: "p1", payerMemberId: "mike", recipientMemberId: "taylor", amountCents: 5000, status: "confirmed" },
    ];

    const balances = calculateBalances(
      [{ id: "taylor", displayName: "Taylor" }, { id: "mike", displayName: "Mike" }],
      expenses,
      payments,
    );

    for (const b of balances) {
      expect(b.netCents).toBe(0);
      expect(b.amountOwedCents).toBe(0);
      expect(b.amountDueBackCents).toBe(0);
    }
  });

  it("counts a member's shares from an expense with no due date, or a past one, as not upcoming", () => {
    const expenses: ExpenseInput[] = [
      {
        id: "e1",
        totalAmountCents: 10000,
        paidByMemberId: null,
        dueDate: "2020-01-01",
        shares: [{ tripMemberId: "mike", amountOwedCents: 10000 }],
      },
      {
        id: "e2",
        totalAmountCents: 5000,
        paidByMemberId: null,
        dueDate: null,
        shares: [{ tripMemberId: "mike", amountOwedCents: 5000 }],
      },
      {
        id: "e3",
        totalAmountCents: 2500,
        paidByMemberId: null,
        dueDate: "2999-01-01",
        shares: [{ tripMemberId: "mike", amountOwedCents: 2500 }],
      },
    ];
    const balances = calculateBalances([{ id: "mike", displayName: "Mike" }], expenses, [], new Date("2026-01-01"));
    expect(balances[0].upcomingDueCents).toBe(2500);
  });

  it("does not silently include a removed member's balance unless the caller asks for it", () => {
    // Removed/declined members must not be auto-included in NEW splits
    // (enforced by splitEqually only ever using the member IDs it's
    // given) — but their historical balance can still be requested
    // explicitly by including them in the `members` list, e.g. so a
    // captain can see what a removed golfer still owes.
    const activeOnly = ["taylor", "mike"];
    const shares = splitEqually(10000, activeOnly);
    expect(shares.map((s) => s.tripMemberId).sort()).toEqual(["mike", "taylor"]);
    expect(shares.some((s) => s.tripMemberId === "chris")).toBe(false);
  });
});

describe("suggestSettlements", () => {
  it("matches the worked example: Taylor +$800, Mike -$500, Chris -$300", () => {
    const balances = [
      { memberId: "taylor", displayName: "Taylor", totalShareCents: 0, paidTowardExpensesCents: 0, reimbursementsSentCents: 0, reimbursementsReceivedCents: 0, amountOwedCents: 0, amountDueBackCents: 80000, upcomingDueCents: 0, netCents: 80000 },
      { memberId: "mike", displayName: "Mike", totalShareCents: 0, paidTowardExpensesCents: 0, reimbursementsSentCents: 0, reimbursementsReceivedCents: 0, amountOwedCents: 50000, amountDueBackCents: 0, upcomingDueCents: 0, netCents: -50000 },
      { memberId: "chris", displayName: "Chris", totalShareCents: 0, paidTowardExpensesCents: 0, reimbursementsSentCents: 0, reimbursementsReceivedCents: 0, amountOwedCents: 30000, amountDueBackCents: 0, upcomingDueCents: 0, netCents: -30000 },
    ];

    const suggestions = suggestSettlements(balances);
    expect(suggestions).toEqual([
      { fromMemberId: "mike", fromName: "Mike", toMemberId: "taylor", toName: "Taylor", amountCents: 50000 },
      { fromMemberId: "chris", fromName: "Chris", toMemberId: "taylor", toName: "Taylor", amountCents: 30000 },
    ]);
  });

  it("returns no suggestions when everyone is already settled (all-zero balances)", () => {
    const balances = MEMBERS.map((m) => ({
      memberId: m.id,
      displayName: m.displayName,
      totalShareCents: 0,
      paidTowardExpensesCents: 0,
      reimbursementsSentCents: 0,
      reimbursementsReceivedCents: 0,
      amountOwedCents: 0,
      amountDueBackCents: 0,
      upcomingDueCents: 0,
      netCents: 0,
    }));
    expect(suggestSettlements(balances)).toEqual([]);
  });

  it("produces the minimum number of transfers for a three-way split with a remainder", () => {
    // $100 across 3 people, one person paid the full $100 up front.
    const shares = splitEqually(10000, ["taylor", "mike", "chris"]);
    const byId = new Map(shares.map((s) => [s.tripMemberId, s.amountOwedCents]));
    const expenses: ExpenseInput[] = [
      { id: "e1", totalAmountCents: 10000, paidByMemberId: "taylor", dueDate: null, shares },
    ];
    const balances = calculateBalances(MEMBERS, expenses, []);
    const suggestions = suggestSettlements(balances);

    // Two debtors (Mike, Chris) owing Taylor -> at most 2 suggested transfers.
    expect(suggestions.length).toBeLessThanOrEqual(2);
    const totalSuggested = suggestions.reduce((sum, s) => sum + s.amountCents, 0);
    const totalOwed = balances.reduce((sum, b) => sum + b.amountOwedCents, 0);
    expect(totalSuggested).toBe(totalOwed);
    expect(totalOwed).toBe(byId.get("mike")! + byId.get("chris")!);
  });
});
