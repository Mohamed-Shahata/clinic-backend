import { IsEnum, IsNumber, IsOptional, Min } from "class-validator";

export enum DoctorPaymentModeDto {
  FIXED_RENT = "FIXED_RENT",
  PERCENTAGE = "PERCENTAGE",
}

export class UpdateDoctorPaymentDto {
  @IsEnum(DoctorPaymentModeDto)
  paymentMode!: DoctorPaymentModeDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedMonthlyRent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  adminPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  followUpFee?: number;
}
