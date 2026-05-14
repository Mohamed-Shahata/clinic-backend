export function normalizePhone(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("20")) return `+${digits}`;
  if (digits.startsWith("0")) return `+20${digits.slice(1)}`;

  return `+20${digits}`;
}

export function normalizeLoginIdentifier(value?: string | null): {
  value: string;
  kind: "email" | "phone";
} | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    return { value: raw.toLowerCase(), kind: "email" };
  }

  const phone = normalizePhone(raw);
  if (phone && /^[+\d\s\-().]+$/.test(raw)) {
    return { value: phone, kind: "phone" };
  }

  return { value: raw.toLowerCase(), kind: "email" };
}
