import { Body, Controller, Get, HttpStatus, Param, Post, Redirect, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { User as UserInfo } from 'src/decorators/auth.decorator';
import { ForgotPasswordRequestDto, LoginRequestDto, ResetPasswordRequestDto } from './dto';
import { CreateUserRequestDto } from './dto/create.user.dto';
import { AuthenticationService } from './auth.service';
import { authConfig } from 'config/auth';
import { SendAuthenticationCodeRequestDto, VerifyAuthenticationCodeRequestDto } from './dto/waitingList.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';

const redirectUrl = authConfig?.pc_ADMIN_BASE_URL + authConfig?.PUBLIC_FILE_UPLOAD;

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthenticationService) {}

  @ApiBody({ type: CreateUserRequestDto })
  @Post('signup')
  async register(@Body() user: CreateUserRequestDto, @Req() req: Request) {
    const baseUrl = req.protocol + '://' + req.headers.host;
    return await this.authService.signUp(user, baseUrl, req);
  }

  @ApiBody({ type: LoginRequestDto })
  @Post('login')
  async login(@Body() user: LoginRequestDto, @Req() req: Request) {
    return await this.authService.login(user, req);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@UserInfo() user: any, @Req() req: Request) {
    return await this.authService.logout(user, req);
  }

  @ApiBody({ type: ForgotPasswordRequestDto })
  @Post('forgot/password/')
  async forgotPassword(@Body() data: ForgotPasswordRequestDto, @Req() req: Request) {
    const url = req.protocol + '://' + req.headers.host;
    return await this.authService.forgotPassword(data.email, url, req);
  }

  @Post('/password-reset/:email/:token')
  async resetPassword(@Param('email') email: string, @Param('token') token: string, @Body() data: ResetPasswordRequestDto, @Req() req: Request) {
    return await this.authService.resetPassword(email, token, data.password, req);
  }

  //TODO
  @Redirect(redirectUrl, HttpStatus.FOUND)
  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    const { data } = await this.authService.verifyEmail(token);

    return { headers: { Authorization: `Bearer ${data?.authToken}` } };
  }

  // Waiting list Authentication
  @Post('waiting-list/login')
  async waitingListLogIn(@Body() data: LoginRequestDto, @Req() req: Request) {
    return await this.authService.waitingListLogIn(data, req);
  }

  @Post('waiting-list/send-authentication-code')
  async sendAuthenticationCode(@Body() data: SendAuthenticationCodeRequestDto, @Req() req: Request) {
    const { email, phone } = data;
    return await this.authService.sendAuthenticationCode(email, req, phone);
  }

  @Post('waiting-list/verify-authentication-code')
  async verifyCode(@Body() data: VerifyAuthenticationCodeRequestDto, @Req() req: Request) {
    return await this.authService.verifyCode(data.email, data, req);
  }
}
