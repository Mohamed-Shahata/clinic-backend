import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  patientId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  doctorId?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  visitType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
