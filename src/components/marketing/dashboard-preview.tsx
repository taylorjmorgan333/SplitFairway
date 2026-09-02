import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

const LINE_ITEMS = [
  { label: "Lodging — the Dunes house", amount: "$2,400.00", people: "8 golfers" },
  { label: "Saturday tee times (2 rounds)", amount: "$960.00", people: "8 golfers" },
  { label: "Rental cars ×2", amount: "$540.00", people: "8 golfers" },
];

const PAYERS = [
  { name: "Mike R.", status: "paid", amount: "$487.50" },
  { name: "Dave T.", status: "paid", amount: "$487.50" },
  { name: "Chris P.", status: "pending", amount: "$487.50" },
  { name: "Sam K.", status: "pending", amount: "$487.50" },
];

export function DashboardPreview() {
  return (
    <section className="bg-cream-50 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">
            One page. Everyone knows where things stand.
          </h2>
          <p className="mt-4 text-lg text-charcoal-500">
            A sample trip dashboard — this is what your group sees.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-forest-900/[0.08] bg-white shadow-card">
          <div className="flex flex-col justify-between gap-4 border-b border-forest-900/[0.06] bg-forest-900 px-6 py-5 text-cream-50 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-gold-300/90">
                Pebble Ridge Trip
              </p>
              <p className="mt-1 font-serif text-xl">Sept 18–21 · 8 golfers</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-cream-100/70">Total outstanding</p>
              <p className="font-serif text-2xl text-gold-300">$975.00</p>
            </div>
          </div>

          <div className="grid gap-8 p-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-forest-900">
                Trip expenses
              </h3>
              <ul className="mt-4 space-y-4">
                {LINE_ITEMS.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between border-b border-cream-200 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm text-charcoal-700">{item.label}</p>
                      <p className="text-xs text-charcoal-400">{item.people}</p>
                    </div>
                    <p className="text-sm font-medium text-forest-900">
                      {item.amount}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-forest-900">
                Who&apos;s settled up
              </h3>
              <ul className="mt-4 space-y-3">
                {PAYERS.map((payer) => (
                  <li
                    key={payer.name}
                    className="flex items-center justify-between rounded-lg bg-cream-50 px-3.5 py-2.5"
                  >
                    <span className="text-sm text-charcoal-700">
                      {payer.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-charcoal-500">
                        {payer.amount}
                      </span>
                      <Badge variant={payer.status === "paid" ? "success" : "warning"}>
                        {payer.status === "paid" ? "Paid" : "Pending"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-charcoal-400">
          Example trip for illustration — payments are recorded from Venmo,
          Zelle, PayPal, cash or check, not processed on this page.
        </p>
      </Container>
    </section>
  );
}
