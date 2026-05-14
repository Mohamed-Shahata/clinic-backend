import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export enum SubscriptionPeriod {
  MONTHLY = "MONTHLY",
  SIX_MONTHS = "SIX_MONTHS",
  YEARLY = "YEARLY",
}

export class CreateClinicDto {
  // ── Required: clinic identity ──────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: "Slug must be lowercase alphanumeric with hyphens only",
  })
  slug!: string;

  // ── Required: doctor admin credentials ────────────────────────────────
  @IsString()
  @IsNotEmpty({ message: "Doctor full name is required" })
  @MaxLength(120)
  adminFullName!: string;

  @IsString()
  @IsNotEmpty({ message: "Admin email is required" })
  @MaxLength(180)
  adminEmail!: string;

  @IsString()
  @IsNotEmpty({ message: "Admin password is required" })
  @MinLength(8)
  @MaxLength(120)
  adminPassword!: string;

  // ── Required: subscription plan ───────────────────────────────────────
  @IsString()
  @IsNotEmpty({ message: "Subscription plan is required" })
  @MaxLength(60)
  subscriptionPeriod!: string;

  // ── Optional fields ───────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  adminPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  adminLogin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  referralCode?: string;
}
