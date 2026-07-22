/** Build UPI deep link for mobile apps (GPay, PhonePe, Paytm, etc.) */
export function buildUpiPayUrl(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  note?: string;
}): string {
  const pa = params.vpa.trim();
  const pn = encodeURIComponent(params.payeeName.slice(0, 80));
  const am = params.amount.toFixed(2);
  const tr = encodeURIComponent(params.transactionRef.slice(0, 40));
  const tn = encodeURIComponent((params.note ?? "Flaze order").slice(0, 80));
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=INR&tn=${tn}&tr=${tr}`;
}

export function isValidUpiVpa(vpa: string): boolean {
  return /^[\w.\-]{2,256}@[\w]{2,64}$/.test(vpa.trim());
}

export interface EffectivePaymentSettings {
  upi_vpa: string | null;
  upi_display_name: string | null;
  upi_qr_url: string | null;
  online_payments_enabled: boolean;
}

export function resolvePaymentSettings(
  outlet: {
    upi_vpa?: string | null;
    upi_display_name?: string | null;
    upi_qr_url?: string | null;
    online_payments_enabled?: boolean | null;
    name?: string;
  },
  profile?: {
    upi_vpa?: string | null;
    upi_display_name?: string | null;
    upi_qr_url?: string | null;
    online_payments_enabled?: boolean | null;
    brand_name?: string | null;
  } | null
): EffectivePaymentSettings {
  const online =
    outlet.online_payments_enabled ??
    profile?.online_payments_enabled ??
    true;
  return {
    upi_vpa: (outlet.upi_vpa?.trim() || profile?.upi_vpa?.trim() || null) ?? null,
    upi_display_name:
      outlet.upi_display_name?.trim() ||
      profile?.upi_display_name?.trim() ||
      profile?.brand_name?.trim() ||
      outlet.name?.trim() ||
      null,
    upi_qr_url: outlet.upi_qr_url?.trim() || profile?.upi_qr_url?.trim() || null,
    online_payments_enabled: online !== false,
  };
}
