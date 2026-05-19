import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsArray,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * الاسم يجب أن يكون ثلاثياً على الأقل (3 كلمات مفصولة بمسافة).
 * يقلل احتمالية تشابه الأسماء لأن الاسم الأول والأخير في مصر كثيراً ما يتكرر.
 */
@ValidatorConstraint({ name: "isTripleName", async: false })
class IsTripleNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    if (typeof value !== "string") return false;
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return parts.length >= 3 && parts.every((part) => part.length >= 2);
  }

  defaultMessage(_args: ValidationArguments): string {
    return "الاسم يجب أن يكون ثلاثياً على الأقل (مثال: محمد علي حسن)";
  }
}

export class MedicalHistoryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronic?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permanentMeds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/i, {
    message: "Code must contain only letters, numbers, and hyphens",
  })
  code!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(120)
  @Validate(IsTripleNameConstraint)
  fullName!: string;

  // الهاتف أصبح إجبارياً للتمييز بين المرضى المتشابهي الأسماء
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[0-9\s-]{8,20}$/, {
    message: "رقم الهاتف غير صالح — يجب أن يكون 8-20 رقماً",
  })
  phone!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  medicalNotes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalHistoryDto)
  medicalHistory?: MedicalHistoryDto;
}
