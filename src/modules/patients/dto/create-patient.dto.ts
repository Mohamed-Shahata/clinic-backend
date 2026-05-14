import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/i, {
    message: "Code must contain only letters, numbers, and hyphens",
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[0-9\s-]{8,20}$/)
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  medicalNotes?: string;
}
