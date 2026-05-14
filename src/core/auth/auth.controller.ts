import { Body, Controller, Get, Post, Patch } from "@nestjs/common";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { LoginDto } from "./dto/login.dto";
import {
  ForgotPasswordRequestDto,
  ForgotPasswordResetDto,
  RequestEmailChangeDto,
  ConfirmEmailChangeDto,
  ChangePasswordDto,
} from "./dto/password-reset.dto";
import { AuthService } from "./auth.service";
import { RequestUser } from "./types/request-user.type";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: RequestUser,
    @Body() body: { refreshToken?: string },
  ) {
    return this.authService.logout(body.refreshToken, user.jti, user.exp);
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  // ─── Forgot Password (public) ──────────────────────────────────────────────

  @Public()
  @Post("forgot-password/request")
  async forgotPasswordRequest(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.requestForgotPassword(dto);
  }

  @Public()
  @Post("forgot-password/reset")
  async forgotPasswordReset(@Body() dto: ForgotPasswordResetDto) {
    return this.authService.resetForgotPassword(dto);
  }

  // ─── Email Change (authenticated) ─────────────────────────────────────────

  @Post("email-change/request")
  async requestEmailChange(
    @CurrentUser() user: RequestUser,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.authService.requestEmailChange(user.userId, dto);
  }

  @Post("email-change/confirm")
  async confirmEmailChange(
    @CurrentUser() user: RequestUser,
    @Body() dto: ConfirmEmailChangeDto,
  ) {
    return this.authService.confirmEmailChange(user.userId, dto);
  }

  // ─── Change Password (authenticated) ──────────────────────────────────────

  @Patch("change-password")
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, dto);
  }
}
