// Ports the SAME eligibility logic the merchant POS pages (pos-web,
// pos-web-grocery) already use to decide whether an activated offer applies
// to a cart — see offerValue()/findMinSpend()/findCategoryGroup() in those
// files. This lets the app itself tell a customer "this invoice already in
// your folder qualifies for your activated offer" instead of that only ever
// being visible at the POS counter, at the moment of a NEW purchase.
//
// The category->item mapping is a merged, best-effort copy of both POS
// pages' own FREE_ITEM_GROUPS — it won't know about a brand-new catalog item
// a merchant adds later without this also being updated, same limitation
// the POS pages themselves have.
import { InvoiceItem } from "@/services/invoices";
import { LiveOffer } from "@/services/offers";
import { LOCALE } from "@/config/locale";

/** Escapes a string for safe use inside a RegExp — needed since the currency
 *  symbol is configurable and some currencies (e.g. "$") are regex-special. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const MIN_SPEND_RE = new RegExp(`(?:over|above)\\s*${escapeRegExp(LOCALE.currencySymbol)}\\s*([\\d,]+)`, "i");

const FREE_ITEM_GROUPS: Record<string, string[]> = {
  // from pos-web (Food)
  dessert: ["Gulab Jamun", "Sweet Lassi"],
  // from pos-web-grocery
  snack: ["Lay's Chips (90 g)", "Parle-G Biscuits (200 g)"],
  beverage: ["Real Fruit Juice (1 L)", "Tata Tea Gold (250 g)", "Nescafé Coffee (100 g)"],
  dairy: ["Full Cream Milk (1 L)", "Brown Eggs (6 pcs)"],
  produce: ["Bananas (1 dozen)", "Tomatoes (1 kg)", "Onions (1 kg)", "Potatoes (1 kg)"],
};

const CATEGORY_KEYWORDS: { phrase: string; group: string }[] = [
  { phrase: "dessert", group: "dessert" },
  { phrase: "fresh produce", group: "produce" },
  { phrase: "produce", group: "produce" },
  { phrase: "dairy", group: "dairy" },
  { phrase: "snack", group: "snack" },
  { phrase: "beverage", group: "beverage" },
];

function findCategoryGroup(desc: string | undefined): string | null {
  const lower = String(desc || "").toLowerCase();
  const hit = CATEGORY_KEYWORDS.find((c) => lower.includes(c.phrase));
  return hit ? hit.group : null;
}

function findMinSpend(desc: string | undefined): number {
  const m = MIN_SPEND_RE.exec(String(desc || ""));
  return m ? parseInt(m[1].replace(/,/g, ""), 10) || 0 : 0;
}

export type OfferEligibility =
  | { kind: "percent"; amount: number; note: string }
  | { kind: "percent-category"; amount: number; note: string }
  | { kind: "free-item"; amount: number; note: string; item: string }
  | { kind: "free-item-unmatched"; amount: number; note: string }
  | { kind: "perk"; amount: number; note: string };

/**
 * Whether `offer` actually applies to `invoice` as it stands — honoring the
 * same conditions the POS would check at bill time (a category restriction,
 * a minimum-spend requirement, whether a matching item is actually there),
 * not just the offer's headline badge.
 */
export function evaluateOfferEligibility(
  offer: Pick<LiveOffer, "pct" | "desc" | "capAmount">,
  items: InvoiceItem[] | undefined,
  subtotal: number
): OfferEligibility {
  const pct = String(offer.pct || "").trim();
  const minSpend = findMinSpend(offer.desc);
  const list = items || [];

  const pctMatch = /^(\d+)\s*%\s*off$/i.exec(pct);
  if (pctMatch) {
    if (minSpend > 0 && subtotal < minSpend) {
      return { kind: "perk", amount: 0, note: `needs a basket over ${LOCALE.currencySymbol}${minSpend.toLocaleString(LOCALE.numberLocale)} to apply` };
    }
    const pctNum = parseInt(pctMatch[1], 10);
    // Same cap enforcement as the POS checkout screens' offerValue() — a
    // campaign's "Capping Amount" ceilings the actual rupee discount, it
    // isn't a minimum-spend gate. See the long comment in pos-web-grocery/
    // index.html's offerValue() for the full reasoning.
    const cap = typeof offer.capAmount === "number" && offer.capAmount > 0 ? offer.capAmount : null;
    const categoryGroup = findCategoryGroup(offer.desc);
    if (categoryGroup) {
      const groupItems = FREE_ITEM_GROUPS[categoryGroup] || [];
      const categorySubtotal = list
        .filter((it) => groupItems.includes(it.name))
        .reduce((s, it) => s + it.unit * it.qty, 0);
      if (categorySubtotal <= 0) {
        return { kind: "perk", amount: 0, note: `no ${categoryGroup} items on this invoice` };
      }
      const raw = Math.round(categorySubtotal * (pctNum / 100));
      const amount = cap != null ? Math.min(raw, cap) : raw;
      const note = cap != null && amount < raw
        ? `${pct} off ${categoryGroup} items — capped at ${LOCALE.currencySymbol}${cap.toLocaleString(LOCALE.numberLocale)}`
        : `${pct} off ${categoryGroup} items — already qualifies`;
      return { kind: "percent-category", amount, note };
    }
    const raw = Math.round(subtotal * (pctNum / 100));
    const amount = cap != null ? Math.min(raw, cap) : raw;
    const note = cap != null && amount < raw
      ? `${pct} off this invoice — capped at ${LOCALE.currencySymbol}${cap.toLocaleString(LOCALE.numberLocale)}`
      : `${pct} off this invoice`;
    return { kind: "percent", amount, note };
  }

  const freeMatch = /^free\s+(.+)$/i.exec(pct);
  if (freeMatch) {
    if (minSpend > 0 && subtotal < minSpend) {
      return { kind: "perk", amount: 0, note: `needs an order over ${LOCALE.currencySymbol}${minSpend.toLocaleString(LOCALE.numberLocale)} to apply` };
    }
    const group = FREE_ITEM_GROUPS[freeMatch[1].toLowerCase().replace(/\s+/g, "")];
    const candidates = group ? list.filter((it) => group.includes(it.name)) : [];
    if (candidates.length) {
      const cheapest = candidates.reduce((a, b) => (b.unit < a.unit ? b : a));
      return { kind: "free-item", amount: cheapest.unit, note: `1× ${cheapest.name} on this invoice`, item: cheapest.name };
    }
    return { kind: "free-item-unmatched", amount: 0, note: `no ${freeMatch[1].toLowerCase()} on this invoice` };
  }

  return { kind: "perk", amount: 0, note: "no bill-value impact — honor in person" };
}

/**
 * Picks whichever of the customer's activated, unredeemed, unexpired offers
 * for this invoice's merchant is actually worth the most against it right
 * now. Returns null if none genuinely qualify (wrong category, under the
 * minimum spend) — a zero-value "best" isn't a real match, just like at the POS.
 */
export function bestEligibleOffer(
  offers: LiveOffer[],
  merchant: string,
  items: InvoiceItem[] | undefined,
  subtotal: number
): { offer: LiveOffer; eligibility: OfferEligibility } | null {
  let best: { offer: LiveOffer; eligibility: OfferEligibility } | null = null;
  for (const offer of offers) {
    if (offer.merchant !== merchant) continue;
    if (!offer.activated || offer.redeemedAtMs) continue;
    if (offer.expiresAtMs && offer.expiresAtMs < Date.now()) continue;
    const eligibility = evaluateOfferEligibility(offer, items, subtotal);
    if (!best || eligibility.amount > best.eligibility.amount) best = { offer, eligibility };
  }
  return best && best.eligibility.amount > 0 ? best : null;
}
