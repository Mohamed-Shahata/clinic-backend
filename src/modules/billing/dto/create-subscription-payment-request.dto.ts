import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateSubscriptionPaymentRequestDto {
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i)
  planId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  transferPhone!: string;

  @IsUrl({ protocols: ["https"], require_tld: true })
  @MaxLength(500)
  screenshotUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePublicSubscriptionPaymentRequestDto extends CreateSubscriptionPaymentRequestDto {
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(180)
  login!: string;
}
