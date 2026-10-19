const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number) {
  return copFormatter.format(Number.isFinite(value) ? value : 0);
}
