import { IsArray, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class MedicationItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePrescriptionDto {
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  patientId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationItemDto)
  medications!: MedicationItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  requestedTests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  requestedImaging?: string[];
}
