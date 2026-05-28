import type { SessionExtra } from "./types";

export function formatCurrency(amount: number, currency = "PKR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)));
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function sumExtras(extras: SessionExtra[] = []) {
  return extras.reduce((a, e) => a + e.price * e.qty, 0);
}

export function calcBill(opts: {
  durationMs: number;
  hourlyRate: number;
  discount: number;
  manualAdjustment: number;
  taxRate: number;
  extrasTotal?: number;
}) {
  const hours = opts.durationMs / 3_600_000;
  const tableCharge = hours * opts.hourlyRate;
  const extras = opts.extrasTotal ?? 0;
  const base = tableCharge + extras;
  const afterDiscount = Math.max(0, base - opts.discount + opts.manualAdjustment);
  const tax = (afterDiscount * opts.taxRate) / 100;
  const total = afterDiscount + tax;
  return { base, tableCharge, extras, tax, total };
}

export function waLink(phone: string, countryCode: string, message: string) {
  const digits = (countryCode + phone).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function thankYouMessage(clubName: string, name: string, total: number, currency: string) {
  return `🎱 Thank you for visiting ${clubName}, ${name}!\n\nYour session bill of ${formatCurrency(total, currency)} is settled. We hope you enjoyed the game on our premium tables.\n\nCome back soon for another round — the green felt awaits. 🟢✨`;
}
