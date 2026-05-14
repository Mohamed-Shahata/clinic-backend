import { ClinicRole } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  jti?: string;
  exp?: number;
  clinicId?: string;
  clinicSlug?: string;
  clinicName?: string;
  role?: ClinicRole;
  isSuperAdmin: boolean;
  email: string | null;
};
