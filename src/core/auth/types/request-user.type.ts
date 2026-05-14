import { ClinicRole } from "@prisma/client";

export type RequestUser = {
  userId: string;
  jti?: string;
  exp?: number;
  email: string | null;
  clinicId?: string;
  clinicSlug?: string;
  clinicName?: string;
  isSuperAdmin: boolean;
  role?: ClinicRole;
};
