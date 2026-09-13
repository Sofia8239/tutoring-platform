/**
 * Money helpers. Golden rule 2: amounts are integer minor units (kopiykas);
 * currency is a separate field; never float arithmetic.
 */

export type Money = {
  /** integer minor units (e.g. kopiykas for UAH) */
  amount: number;
  currency: string;
};

const MINOR_UNITS_PER_MAJOR = 100;

/** "150.50" / "150,50" / 150.5 -> 15050 minor units. Throws on garbage. */
export function toMinorUnits(major: string | number): number {
  const normalized =
    typeof major === "number"
      ? major.toString()
      : major.trim().replace(",", ".");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Cannot parse money amount: ${JSON.stringify(major)}`);
  }

  const [whole, frac = ""] = normalized.replace("-", "").split(".");
  const minor =
    Number(whole) * MINOR_UNITS_PER_MAJOR + Number(frac.padEnd(2, "0"));

  return normalized.startsWith("-") ? -minor : minor;
}

/** 15050 -> "150.50" (dot, no grouping, always 2 decimals). */
export function toMajorString(minor: number): string {
  assertInteger(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / MINOR_UNITS_PER_MAJOR);
  const frac = abs % MINOR_UNITS_PER_MAJOR;
  return `${sign}${whole}.${frac.toString().padStart(2, "0")}`;
}

/** Locale-aware display, e.g. 15050 UAH -> "150,50 ₴" (uk-UA). */
export function formatMoney(
  minor: number,
  currency = "UAH",
  locale = "uk-UA",
): string {
  assertInteger(minor);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minor / MINOR_UNITS_PER_MAJOR);
}

/** Sum of minor-unit amounts. Guards against accidental float inputs. */
export function sumMinor(amounts: readonly number[]): number {
  return amounts.reduce((total, next) => {
    assertInteger(next);
    return total + next;
  }, 0);
}

function assertInteger(minor: number): void {
  if (!Number.isInteger(minor)) {
    throw new Error(`Money must be an integer number of minor units: ${minor}`);
  }
}
