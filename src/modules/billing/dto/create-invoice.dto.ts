import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class InvoiceServiceLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateInvoiceDto {
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  patientId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  appointmentId?: string;

  @IsIn(["cash", "vodafone_cash"])
  paymentMethod!: "cash" | "vodafone_cash";

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceServiceLineDto)
  services!: InvoiceServiceLineDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
