/**
 * P4: money is stored as integer para (1 RSD = 100 para) to avoid decimal
 * rounding errors. The API's public contract stays in whole RSD (dinars) —
 * these two helpers are the only place the x100 conversion happens.
 */
export function rsdToPara(rsd: number): bigint {
  return BigInt(Math.round(rsd * 100));
}

export function paraToRsd(para: bigint | null | undefined): number | null {
  if (para === null || para === undefined) return null;
  return Number(para) / 100;
}
