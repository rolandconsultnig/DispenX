const MONEY_DP = 2;
const LITERS_DP = 3;

function round(value: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function toMoney(value: number): number {
  return round(Number(value || 0), MONEY_DP);
}

export function toLiters(value: number): number {
  return round(Number(value || 0), LITERS_DP);
}

export function litersFromNaira(naira: number, pricePerLiter: number): number {
  if (!pricePerLiter || pricePerLiter <= 0) return 0;
  return toLiters(Number(naira || 0) / Number(pricePerLiter));
}

export function nairaFromLiters(liters: number, pricePerLiter: number): number {
  return toMoney(Number(liters || 0) * Number(pricePerLiter || 0));
}
