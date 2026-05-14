import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

@ValidatorConstraint({ name: "LoginOrEmail", async: false })
class LoginOrEmailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const obj = args.object as { login?: string; email?: string };
    return (
      (typeof obj.login === "string" && obj.login.trim().length > 0) ||
      (typeof obj.email === "string" && obj.email.trim().length > 0)
    );
  }

  defaultMessage() {
    return "Either login or email must be provided";
  }
}

export class LoginDto {
  @Validate(LoginOrEmailConstraint)
  @IsOptional()
  @IsString()
  @MaxLength(180)
  login?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clinicSlug?: string;
}
