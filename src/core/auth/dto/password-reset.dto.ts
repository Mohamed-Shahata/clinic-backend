import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;
}

export class ForgotPasswordResetDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}

export class RequestEmailChangeDto {
  @IsEmail()
  @MaxLength(180)
  newEmail!: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}
