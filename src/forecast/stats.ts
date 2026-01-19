
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

export function quantiles(xs: number[], qs: number[]) {
  const s = [...xs].sort((a,b)=>a-b);
  return qs.map(q => quantile(s, q));
}
