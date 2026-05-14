import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { SubscriptionPeriod } from "../../clinics/dto/create-clinic.dto";

export class CreateClinicDoctorDto {
  // ✅ email optional - يكفي phone أو email على الأقل واحد
  @IsOptional()
  @ValidateIf((o: CreateClinicDoctorDto) => !!o.email)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @IsEnum(SubscriptionPeriod)
  subscriptionPeriod?: SubscriptionPeriod;
}
