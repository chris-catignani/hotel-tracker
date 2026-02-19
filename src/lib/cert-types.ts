export const CERT_TYPE_OPTIONS = [
  { value: "marriott_40k", label: "Marriott 40k" },
  { value: "marriott_35k", label: "Marriott 35k" },
  { value: "marriott_85k", label: "Marriott 85k" },
  { value: "hyatt_cat1_4", label: "Hyatt Cat 1–4" },
  { value: "hyatt_cat1_7", label: "Hyatt Cat 1–7" },
  { value: "ihg_40k",      label: "IHG 40k" },
] as const;

export type CertTypeValue = typeof CERT_TYPE_OPTIONS[number]["value"];

export function certTypeLabel(certType: string): string {
  return CERT_TYPE_OPTIONS.find((o) => o.value === certType)?.label ?? certType;
}
