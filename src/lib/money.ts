/**
 * Money helpers.
 *
 * All money in EveryNest is stored as integer paisa (1 rupee = 100 paisa).
 * These helpers never use floating point arithmetic for conversions. They are
 * safe for both server and client code, and they are covered by unit tests.
 */

export const PAISA_PER_RUPEE = 100n;

/** Maximum safe integer in JavaScript; larger values must stay as bigint. */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Validates a paisa value that is about to be treated as a JavaScript number.
 * Throws instead of silently losing precision.
 */
export function assertSafePaisa(value: number): number {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Paisa values must be integers, received ${value}.`);
  }
  if (value < 0) {
    throw new RangeError(`Paisa values cannot be negative, received ${value}.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Paisa value ${value} exceeds the safe integer range.`);
  }
  return value;
}

/**
 * Converts a rupee string (for example "1,500.50") to integer paisa.
 *
 * Accepts an optional "Rs." / "PKR" prefix, thousands separators, and one or
 * two decimal places. Rejects anything else instead of rounding silently.
 */
export function rupeesToPaisa(input: string | number): number {
  const raw = typeof input === "number" ? String(input) : input;

  const cleaned = raw
    .trim()
    .replace(/^(?:rs\.?|pkr)\s*/i, "")
    .replace(/,/g, "")
    .replace(/^\+/, "");

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);

  if (!match) {
    throw new RangeError(`"${raw}" is not a valid rupee amount.`);
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const paisa = whole * PAISA_PER_RUPEE + fraction;

  if (paisa > MAX_SAFE) {
    throw new RangeError(`Amount "${raw}" is too large to handle as a safe integer.`);
  }

  return Number(paisa);
}

/**
 * Converts integer paisa to a plain decimal rupee string ("150050" -> "1500.50").
 * Useful for database/report output where grouping is not wanted.
 */
export function paisaToRupees(paisa: number | bigint): string {
  const value = typeof paisa === "bigint" ? paisa : BigInt(paisa);
  const negative = value < 0n;
  const absolute = negative ? -value : value;

  const rupees = absolute / PAISA_PER_RUPEE;
  const fraction = absolute % PAISA_PER_RUPEE;

  const decimals = fraction === 0n ? "" : `.${fraction.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}${rupees.toString()}${decimals}`;
}

/**
 * Formats paisa for display in Pakistani Rupees: "Rs. 1,500" or "Rs. 1,500.50".
 * Thousands separators are applied to the rupee part only.
 */
export function formatPkr(paisa: number | bigint): string {
  const value = typeof paisa === "bigint" ? paisa : BigInt(paisa);
  const negative = value < 0n;
  const absolute = negative ? -value : value;

  const rupees = absolute / PAISA_PER_RUPEE;
  const fraction = absolute % PAISA_PER_RUPEE;

  const grouped = rupees.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fraction === 0n ? "" : `.${fraction.toString().padStart(2, "0")}`;

  return `${negative ? "-" : ""}Rs. ${grouped}${decimals}`;
}

/**
 * Applies an optional sale price on top of a regular price.
 * Both values are paisa; the sale price must be lower than the regular price.
 */
export function effectivePricePaisa(pricePaisa: number, salePricePaisa: number | null): number {
  if (salePricePaisa === null) return pricePaisa;
  if (salePricePaisa >= pricePaisa) {
    throw new RangeError("Sale price must be lower than the regular price.");
  }
  return salePricePaisa;
}
