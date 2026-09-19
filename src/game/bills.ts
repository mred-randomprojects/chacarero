import { BILL_DENOMINATIONS } from "./constants";

export type Denomination = (typeof BILL_DENOMINATIONS)[number];

/**
 * A "starter kit" of small bills every player is handed first, so a pile of
 * cash looks like a wallet rather than seven $5.000 notes. Purely cosmetic.
 */
const KIT: Readonly<Record<Denomination, number>> = { 10: 5, 50: 2, 100: 3, 200: 2, 500: 2, 1000: 3, 2000: 2, 5000: 0 };
const KIT_TOTAL = (Object.entries(KIT) as [string, number][]).reduce((sum, [d, n]) => sum + Number(d) * n, 0);

/**
 * Splits an amount into bills. Amounts in the game are always multiples of
 * $10; anything smaller is dropped. The result always sums to the input.
 */
export function billBreakdown(cash: number): Record<Denomination, number> {
  const result: Record<Denomination, number> = { 10: 0, 50: 0, 100: 0, 200: 0, 500: 0, 1000: 0, 2000: 0, 5000: 0 };
  let remaining = Math.max(0, Math.floor(cash / 10) * 10);
  if (remaining >= KIT_TOTAL) {
    for (const d of BILL_DENOMINATIONS) result[d] += KIT[d];
    remaining -= KIT_TOTAL;
  }
  for (const d of [...BILL_DENOMINATIONS].reverse()) {
    const count = Math.floor(remaining / d);
    result[d] += count;
    remaining -= count * d;
  }
  return result;
}

/** Total of a breakdown, for sanity checks. */
export function billTotal(bills: Readonly<Record<Denomination, number>>): number {
  return BILL_DENOMINATIONS.reduce((sum, d) => sum + d * bills[d], 0);
}
