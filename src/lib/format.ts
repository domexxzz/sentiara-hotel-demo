/** Thai baht, grouped, no decimals — the one formatter every flow shares. */
export const money = (n: number) => "฿" + Math.round(n).toLocaleString("en-US");

/** Signed percentage for period-over-period deltas, e.g. "+11%" / "−4%". */
export const delta = (now: number, before: number) => {
  const pct = Math.round(((now - before) / before) * 100);
  return (pct >= 0 ? "+" : "−") + Math.abs(pct) + "%";
};
