export type IncludedTaxBreakdown = {
  taxCents: number;
  netCents: number;
};

export type IncludedTaxInput = {
  itemsSubtotal: number | null | undefined;
  discountTotal: number | null | undefined;
  promoDiscountTotal: number | null | undefined;
  shippingFee: number | null | undefined;
  codFee: number | null | undefined;
  shippingTaxable: boolean;
  codTaxable: boolean;
  enabled: boolean;
  ratePct: number;
};

export function toCents(value: number | null | undefined): number {
  const num = Number.isFinite(value as number) ? (value as number) : 0;
  return Math.round(num * 100);
}

export function fromCents(cents: number): number {
  const safe = Number.isFinite(cents) ? cents : 0;
  return safe / 100;
}

export function clampRatePct(ratePct: number): number {
  if (!Number.isFinite(ratePct)) return 0;
  return Math.min(Math.max(ratePct, 0), 30);
}

export function calcIncludedTaxBreakdown(
  grossCents: number,
  ratePct: number,
): IncludedTaxBreakdown {
  const safeGross = Number.isFinite(grossCents)
    ? Math.max(0, Math.round(grossCents))
    : 0;
  const safeRate = clampRatePct(ratePct);

  if (safeGross <= 0 || safeRate <= 0) {
    return { taxCents: 0, netCents: safeGross };
  }

  const taxCents = Math.round((safeGross * safeRate) / (100 + safeRate));
  return { taxCents, netCents: safeGross - taxCents };
}

export function calcIncludedTaxFromTotals(input: IncludedTaxInput): {
  grossTaxableCents: number;
  taxCents: number;
  netCents: number;
} {
  const itemsSubtotalCents = toCents(input.itemsSubtotal);
  const discountCents = toCents(
    (input.discountTotal ?? 0) + (input.promoDiscountTotal ?? 0),
  );
  const shippingCents = toCents(input.shippingFee);
  const codCents = toCents(input.codFee);

  const grossTaxableCents = Math.max(
    0,
    itemsSubtotalCents -
      discountCents +
      (input.shippingTaxable ? shippingCents : 0) +
      (input.codTaxable ? codCents : 0),
  );

  if (!input.enabled) {
    return { grossTaxableCents, taxCents: 0, netCents: grossTaxableCents };
  }

  const { taxCents, netCents } = calcIncludedTaxBreakdown(
    grossTaxableCents,
    input.ratePct,
  );

  return { grossTaxableCents, taxCents, netCents };
}
