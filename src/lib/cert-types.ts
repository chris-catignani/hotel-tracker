export const CERT_TYPE_OPTIONS = [
  { value: "marriott_35k", label: "Marriott 35k", pointsValue: 35000 },
  { value: "marriott_40k", label: "Marriott 40k", pointsValue: 40000 },
  { value: "marriott_50k", label: "Marriott 50k", pointsValue: 50000 },
  { value: "marriott_85k", label: "Marriott 85k", pointsValue: 85000 },
  { value: "hyatt_cat1_4", label: "Hyatt Cat 1–4", pointsValue: 15000 },
  { value: "hyatt_cat1_7", label: "Hyatt Cat 1–7", pointsValue: 30000 },
  { value: "ihg_40k",      label: "IHG 40k",       pointsValue: 40000 },
] as const;

export type CertTypeValue = typeof CERT_TYPE_OPTIONS[number]["value"];

export function certTypeLabel(certType: string): string {
  return CERT_TYPE_OPTIONS.find((o) => o.value === certType)?.label ?? certType;
}

export function certPointsValue(certType: string): number {
  return CERT_TYPE_OPTIONS.find((o) => o.value === certType)?.pointsValue ?? 0;
}
