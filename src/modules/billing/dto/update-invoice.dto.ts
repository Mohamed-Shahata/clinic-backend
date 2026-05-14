import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";
import { InvoiceServiceLineDto } from "./create-invoice.dto";

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  patientId?: string;

  @IsOptional()
  @IsIn(["cash", "vodafone_cash"])
  paymentMethod?: "cash" | "vodafone_cash";

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceServiceLineDto)
  services?: InvoiceServiceLineDto[];
}
