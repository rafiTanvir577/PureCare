import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { authConfig } from 'config/auth';
import { SMSService } from 'src/helper/smsService';
import { UserJwtPayload, LoginErrorMessage, LoginRequest, SignUpErrorMessage, UpdateUserErrorMessage, User, Role, UserStatus } from 'src/entity';
import { UserRepository } from 'src/modules/user/repository/user.repository';
import { SendGridService } from 'src/helper/sendgrid';
import { LoginAttemptRepository } from './repository/login-attempts.repository';
import { APIResponse, IResponse } from 'src/internal/api-response/api-response.service';
import base64url from 'base64url';
import { WaitingListRepository } from '../waiting-list/repository/waiting-list.repository';
import { WaitingListErrorMessages, WaitingListSuccessMessages, WaitingListUser, WaitingListUserAuthenticationCodeTypes, WaitingListUserQualificationStatus } from 'src/entity/waiting-list.entity';
import { Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogResultType } from 'src/entity/audit.entity';
import { getIpAddress } from 'src/helper/utils/ip';
const ONE_HOUR = 3600000; // 1 hour = 3600000 milliseconds
const chars = '123456789ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz';

@Injectable()
export class AuthenticationService {
  constructor(
    private userRepo: UserRepository,
    private mailService: SendGridService,
    private smsService: SMSService,
    private jwtService: JwtService,
    private readonly response: APIResponse,
    private waitingListRepo: WaitingListRepository,
    private eventEmitter: EventEmitter2,
    private loginAttemptsRepo: LoginAttemptRepository,
  ) {}

  async signUp(data: Partial<User>, baseUrl: string, req: Request): Promise<IResponse<User>> {
    let user;
    const userExists = await this.userRepo.findUser({
      email: data?.email,
    });

    if (userExists) throw new HttpException({ message: 'User already exists with this email' }, HttpStatus.BAD_REQUEST, { description: 'User already exists with this email' });

    data.password = await bcrypt.hash(data?.password, authConfig?.salt);
    data['role'] = Role.PRE_ADMIN;

    try {
      user = await this.userRepo.createUser({
        ...data,
        status: UserStatus.PENDING,
      });
    } catch (err) {
      console.log(err);
      throw new HttpException({ message: SignUpErrorMessage.CANNOT_CREATE_USER }, HttpStatus.INTERNAL_SERVER_ERROR, { description: SignUpErrorMessage.CANNOT_CREATE_USER });
    }

    const queryParams = await this.buildEncodedQueryParams(user?.email);
    const verifyEmailLink = baseUrl + `/api/auth/verify-email/${queryParams}`;
    const template = fs.readFileSync('src/helper/templates/verify.email.html', 'utf8');
    const html = ejs.render(template, { url: verifyEmailLink });

    try {
      await this.mailService.sendMail(user?.email, 'Verify Email', verifyEmailLink, html);
    } catch (err) {
      console.log(err);
      throw new HttpException({ message: 'Could not verify your email address' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not verify your email address' });
    }

    this.triggerEvent(user, req, 'registered');
    return this.response.success(user, {
      message: 'Verification Email send successful',
    });
  }

  async login(data: LoginRequest, req: Request): Promise<IResponse<any>> {
    const userEmail = data.email;
    const ip = getIpAddress(req);

    const { _id: attemptId } = await this.loginAttemptsRepo.addLoginAttempt({
      email: userEmail,
      role: Role.ADMIN,
      deviceToken: data.deviceToken,
      ip,
      platform: data.metaData.platform,
      timezone: data.metaData.timezone,
    });
    // check login attempts
    await this.checkLoginAttempt({
      userEmail,
      role: Role.ADMIN,
      deviceToken: data.deviceToken,
      ip,
      platform: data.metaData.platform,
      timezone: data.metaData.timezone,
    });

    const userExists = await this.userRepo.findUser({ email: userEmail });

    if (!userExists || userExists?.status === UserStatus.INACTIVE || !userExists?.password)
      throw new HttpException(
        {
          message: !userExists ? LoginErrorMessage.INVALID_CREDENTIALS : LoginErrorMessage.ACCOUNT_ERROR,
        },
        HttpStatus.BAD_REQUEST,
      );

    const doesPasswordMatch = await bcrypt.compare(data.password, userExists.password);

    if (!doesPasswordMatch) {
      throw new HttpException({ message: LoginErrorMessage.INVALID_CREDENTIALS }, HttpStatus.BAD_REQUEST, { description: LoginErrorMessage.INVALID_CREDENTIALS });
    }
    await this.loginAttemptsRepo.updateLoginAttemptAsSuccess(attemptId);

    const { role } = userExists;
    let permissions;

    if (role === Role.TEAM_MEMBER) {
      const { features } = await this.userRepo.findUser({ id: userExists?.id });
      permissions = await this.userRepo.getFeatures(features);
    } else if (role === Role.ADMIN) {
      permissions = (await this.userRepo.findUser({
        email: userExists?.email,
        role: Role.ADMIN,
        status: UserStatus.APPROVED,
      }))
        ? await this.userRepo.getPermissions(role)
        : null;
    } else {
      permissions = await this.userRepo.getPermissions(role);
    }

    const payload: UserJwtPayload = {
      role,
      id: userExists.id,
      email: userExists.email,
      admins: userExists?.role === Role.TEAM_MEMBER && userExists?.admins,
      logInTime: Date.now(),
    };
    if (role === Role.DATA_OPERATOR || role === Role.DATA_SUPERVISOR) {
      const sessionId = crypto.randomUUID();
      payload.sessionId = sessionId;
      const updatedData: any = { sessionId };
      const matchedDeviceToken = userExists.deviceTokens?.includes(data.deviceToken);

      if (!matchedDeviceToken && userExists?.deviceTokens?.length) {
        this.sendLoginNotificationEmail(
          userExists.email,
          {
            device: data.metaData?.platform,
            timezone: data.metaData?.timezone,
          },
          req,
        );
      }
      if (!matchedDeviceToken) {
        updatedData.$push = { deviceTokens: data.deviceToken };
      }
      this.userRepo.updateUser({ id: userExists.id }, updatedData);
    }

    const token = this.jwtService.sign(payload);

    this.triggerEvent(userExists, req, 'logged in');
    return this.response.success({
      token,
      permissions,
      role,
      id: userExists?.id,
    });
  }

  private async checkLoginAttempt(data: { userEmail: string; role: Role.ADMIN | Role.PRACTITIONER; deviceToken: string; ip: string; platform: string; timezone: string }): Promise<void> {
    const { userEmail, role, ip, platform, timezone } = data;
    const windowStartAt = new Date();
    windowStartAt.setTime(windowStartAt.getTime() - authConfig.rateLimitWindow * 60 * 1000);

    const singleEmailFailedAttempts = await this.loginAttemptsRepo.getLoginAttempts({
      createdAt: { $gte: windowStartAt },
      email: userEmail,
      role,
      isSuccess: false,
    });

    // Case for single email targeted
    if (singleEmailFailedAttempts.length > authConfig.singleUserLoginRateLimit) {
      const user = role === Role.ADMIN ? await this.waitingListRepo.findWaitingListUser({ email: userEmail }) : await this.userRepo.findUser({ email: userEmail });

      // If user exists then notify that user
      if (user) {
        await this.loginAttemptsRepo.notifyUserAboutExcessiveLoginAttempts(singleEmailFailedAttempts[0]);
      }
      // Notify admin for multiple login attempt failed for a single user
      await this.loginAttemptsRepo.notifyAdminAboutExcessiveLoginAttempts(singleEmailFailedAttempts);
      // Block user for multiple failed login attempts within a time window
      throw new HttpException(
        {
          message: 'You have exceeded the maximum login attempts. Please try again after some time.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const multipleAttemptsFromSameIP = await this.loginAttemptsRepo.getLoginAttempts({
      createdAt: { $gte: windowStartAt },
      ip,
    });

    // Multiple attempt from same IP
    if (multipleAttemptsFromSameIP.length > 2) {
      await this.loginAttemptsRepo.notifyExcessiveSameIPLoginAttempts(multipleAttemptsFromSameIP, ip, platform, timezone);
    }
  }

  async logout(user: { role: Role; id: number; sessionId: string }, req: Request): Promise<IResponse<any>> {
    const { role, id, sessionId } = user;
    let successfulLogoutUser = null;
    if (role === Role.PRACTITIONER) {
      const waitingListUser = await this.waitingListRepo.findWaitingListUser({
        id,
      });
      const sessionIds = waitingListUser.sessionIds.filter((session) => session !== sessionId);
      successfulLogoutUser = await this.waitingListRepo.updatedWaitingListUser({ id }, { sessionIds });
    } else {
      successfulLogoutUser = await this.userRepo.updateUser({ id }, { sessionId: null });
    }
    if (!successfulLogoutUser) throw new HttpException({ message: 'Failed to log out' }, HttpStatus.BAD_REQUEST);

    this.triggerEvent(successfulLogoutUser, req, 'logged out of your account');
    return this.response.success({
      message: 'Successfully logged out',
    });
  }

  async forgotPassword(email: string, baseUrl: string, req: Request): Promise<IResponse<any>> {
    const user = await this.userRepo.findUser({ email });
    if (!user) throw new HttpException({ message: UpdateUserErrorMessage.INVALID_CREDENTIALS }, HttpStatus.BAD_REQUEST, { description: UpdateUserErrorMessage.INVALID_CREDENTIALS });

    const token = crypto.randomBytes(20).toString('hex');
    const hashedToken = await bcrypt.hash(token, authConfig.salt);

    //const resetPasswordToken = hashedToken;
    //const resetPasswordExpires = Date.now() + ONE_HOUR;
    const updates = {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: Date.now() + ONE_HOUR,
    };

    const updatedUser = await this.userRepo.updateUser({ id: user.id }, updates);
    if (!updatedUser)
      return {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: UpdateUserErrorMessage.CANNOT_UPDATE_USER,
      };

    const resetUrl = baseUrl + authConfig.AUTH_RESET_ORIGINAL_URL + user.email + '/' + token;

    try {
      //TODO: add a proper email template & format
      await this.mailService.sendMail(user.email, 'Password Reset Link', resetUrl, resetUrl);

      this.triggerEvent(updatedUser, req, 'requested to reset password (i.e forgot-password)');
      return this.response.success();
    } catch (err) {
      console.log(err);
      return {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: UpdateUserErrorMessage.CANNOT_UPDATE_PASSWORD,
      };
    }
  }

  async resetPassword(email: string, token: string, password: string, req: Request): Promise<IResponse<User>> {
    const userExists = await this.userRepo.findUser({ email });
    if (!userExists || !userExists.resetPasswordToken) throw new HttpException({ message: UpdateUserErrorMessage.INVALID_CREDENTIALS }, HttpStatus.BAD_REQUEST, { description: UpdateUserErrorMessage.INVALID_CREDENTIALS });

    const isValidToken = await bcrypt.compare(token, userExists.resetPasswordToken);
    if (!isValidToken) throw new HttpException({ message: UpdateUserErrorMessage.INVALID_CREDENTIALS }, HttpStatus.BAD_REQUEST, { description: UpdateUserErrorMessage.INVALID_CREDENTIALS });

    if (userExists.resetPasswordExpires < Date.now()) throw new HttpException({ message: UpdateUserErrorMessage.TIME_EXPIRED }, HttpStatus.BAD_REQUEST, { description: UpdateUserErrorMessage.TIME_EXPIRED });

    //TODO: token url structure
    const hashedPassword = await bcrypt.hash(password, authConfig.salt);
    userExists.password = hashedPassword;
    delete userExists.resetPasswordExpires;
    delete userExists.resetPasswordToken;

    const updatedUser = await this.userRepo.updateUser({ id: userExists.id }, userExists);

    if (!updatedUser) throw new HttpException({ message: UpdateUserErrorMessage.CANNOT_UPDATE_PASSWORD }, HttpStatus.INTERNAL_SERVER_ERROR, { description: UpdateUserErrorMessage.CANNOT_UPDATE_PASSWORD });

    this.triggerEvent(updatedUser, req, 'reset the password');
    return this.response.success(updatedUser);
  }

  async verifyEmail(token: string): Promise<IResponse<any>> {
    const urlParam = Buffer.from(base64url.decode(token)).toString('utf8');

    const email = urlParam.split('&')[0].split('=')[1];
    const validEmail = await this.userRepo.findUser({
      email,
      role: Role.PRE_ADMIN,
      status: UserStatus.PENDING,
    });

    if (!validEmail) throw new HttpException({ message: 'Invalid Email' }, HttpStatus.BAD_REQUEST, { description: 'Invalid Email' });

    try {
      await this.userRepo.updateUser(
        { email },
        {
          status: UserStatus.EMAIL_VERIFIED,
        },
      );
    } catch (err) {
      console.log(err);
      throw new HttpException({ message: 'Could not verify email' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not verify email' });
    }

    const payload: UserJwtPayload = {
      role: Role.PRE_ADMIN,
      id: validEmail?.id,
      email: validEmail?.email,
      logInTime: Date.now(),
    };
    const authToken = this.jwtService.sign(payload);

    return this.response.success({ authToken });
  }

  async waitingListLogIn(data: LoginRequest, req: Request): Promise<IResponse<Partial<WaitingListUser>>> {
    const { email, password } = data;
    const ip = getIpAddress(req);
    const { _id: attemptId } = await this.loginAttemptsRepo.addLoginAttempt({
      email,
      role: Role.PRACTITIONER,
      deviceToken: data.deviceToken,
      ip,
      platform: data.metaData.platform,
      timezone: data.metaData.timezone,
    });
    await this.checkLoginAttempt({
      userEmail: email,
      role: Role.PRACTITIONER,
      deviceToken: data.deviceToken,
      ip,
      platform: data.metaData.platform,
      timezone: data.metaData.timezone,
    });

    const [waitingListUser, deActiveWaitingListUser] = await Promise.all([
      await this.waitingListRepo.findWaitingListUserWithPassword({
        email,
        qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      }),
      await this.waitingListRepo.findDeActiveWaitingListUser({
        email,
      }),
    ]);
    if (!waitingListUser || deActiveWaitingListUser)
      throw new HttpException(
        {
          message: deActiveWaitingListUser ? 'Account error. Please contact us for help.' : LoginErrorMessage.INVALID_CREDENTIALS,
        },
        HttpStatus.BAD_REQUEST,
      );

    const doesPasswordMatch = await bcrypt.compare(password, waitingListUser.password);

    if (!doesPasswordMatch) {
      throw new HttpException({ message: LoginErrorMessage.INVALID_CREDENTIALS }, HttpStatus.BAD_REQUEST);
    }

    await this.loginAttemptsRepo.updateLoginAttemptAsSuccess(attemptId);

    this.triggerEvent(
      {
        ...waitingListUser,
        role: Role.PRACTITIONER,
      },
      req,
      'logged in, waiting for OTP verification.',
      AuditLogResultType.CONFUSED,
    );
    const matchedDeviceToken = waitingListUser.deviceTokens?.includes(data.deviceToken);
    const updatedData: any = {};
    if (!matchedDeviceToken && waitingListUser?.deviceTokens?.length) {
      this.sendLoginNotificationEmail(
        waitingListUser.email,
        {
          device: data.metaData?.platform,
          timezone: data.metaData?.timezone,
        },
        req,
      );
    }
    if (!matchedDeviceToken) {
      updatedData.$push = { deviceTokens: data.deviceToken };
      this.waitingListRepo.updatedWaitingListUser({ id: waitingListUser.id }, updatedData);
    }

    return this.response.success({
      email: waitingListUser.email,
      isMfaAdded: waitingListUser.isMfaAdded,
    });
  }

  async sendAuthenticationCode(email: string, req: Request, phone?: string): Promise<IResponse<{ message: string }>> {
    const [waitingListUser, deActiveWaitingListUser] = await Promise.all([
      await this.waitingListRepo.findWaitingListUserWithPassword({
        email,
        qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      }),
      await this.waitingListRepo.findDeActiveWaitingListUser({
        email,
      }),
    ]);
    if (!waitingListUser || deActiveWaitingListUser)
      throw new HttpException(
        {
          message: deActiveWaitingListUser ? 'Account error. Please contact us for help.' : WaitingListErrorMessages.INVALID_EMAIL,
        },
        HttpStatus.BAD_REQUEST,
      );

    //priority is 1. Given input number, 2. Already added mfa 3. empty string
    const userPhone = phone || waitingListUser?.phone || '';

    // if user tries to use other number than already verified number
    if (waitingListUser?.isMfaAdded === true && userPhone !== '' && userPhone !== waitingListUser.phone) {
      throw new HttpException({ message: WaitingListErrorMessages.INVALID_CREDENTIALS }, HttpStatus.BAD_REQUEST);
    }
    const authenticationCode = Math.floor(100000 + Math.random() * 900000);
    await this.waitingListRepo.updatedWaitingListUser(
      { email },
      {
        authenticationCode: String(authenticationCode),
        authenticationCodeExpirationTime: Date.now() + +authConfig?.AUTHENTICATION_CODE_EXPIRATION_TIME * 60 * 1000,
        phone: userPhone,
      },
    );

    // Send authentication code to this waiting list phone number
    this.smsService.sendSMS(userPhone, `${authenticationCode} is your pc authentication code.`);
    return this.response.success({
      message: WaitingListSuccessMessages.SUCCESSFULLY_SEND_SMS,
    });
  }

  async verifyCode(
    email: string,
    data: {
      authenticationCode: string;
      type: string;
    },
    req: Request,
  ): Promise<IResponse<{ token: string; recoveryCodes: { code: string }[] }>> {
    const { type, authenticationCode } = data;
    return type === WaitingListUserAuthenticationCodeTypes.AUTHENTICATION_CODE ? await this.verifyAuthenticationCode(email, authenticationCode, req) : await this.verifyRecoveryCode(email, authenticationCode, req);
  }

  //private functions
  private buildEncodedQueryParams(email: string): string {
    const queryParams = `email=${email}`;
    return base64url(Buffer.from(queryParams));
  }

  private async verifyAuthenticationCode(
    email: string,
    authenticationCode: string,
    req: Request,
  ): Promise<
    IResponse<{
      token: string;
      permissions: any;
      recoveryCodes: { code: string }[];
    }>
  > {
    let recoveryCodes: { code: string }[] = [];
    const user = await this.waitingListRepo.findWaitingListUser({
      email,
      authenticationCode,
      isEmailVerified: true,
      qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      authenticationCodeExpirationTime: { $gt: Date.now() },
    });
    if (!user) throw new HttpException({ message: WaitingListErrorMessages.INVALID_CODE }, HttpStatus.BAD_REQUEST);

    // Save recovery codes into db
    if (!user.recoveryCodes || !user.recoveryCodes.length) {
      recoveryCodes = this.generateRecoveryCodes();
      const hashedRecoveryCodes: any = await this.generateHashRecoveryCodes(recoveryCodes);
      await this.waitingListRepo.updatedWaitingListUser(
        {
          email,
        },
        {
          recoveryCodes: hashedRecoveryCodes,
          isMfaAdded: true,
        },
      );
    }

    const payload: any = {
      id: user.id,
      email: user.email,
      role: Role.PRACTITIONER,
      logInTime: Date.now(),
    };

    const sessionId = crypto.randomUUID();
    payload.sessionId = sessionId;
    const token = this.jwtService.sign(payload);
    this.waitingListRepo.updatedWaitingListUser(
      {
        email,
      },
      { $push: { sessionIds: sessionId } },
    );
    const permissions = await this.userRepo.getPermissions(Role.PRACTITIONER);

    this.triggerEvent(
      {
        ...user,
        role: Role.PRACTITIONER,
      },
      req,
      'logged in by verifying otp',
    );
    return this.response.success({
      token,
      permissions,
      recoveryCodes,
      id: user.id,
    });
  }

  private async verifyRecoveryCode(
    email: string,
    recoveryCode: string,
    req: Request,
  ): Promise<
    IResponse<{
      token: string;
      permissions: any;
      recoveryCodes: { code: string }[];
    }>
  > {
    const user = await this.waitingListRepo.findWaitingListUser({
      email,
      qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      isMfaAdded: true,
      isEmailVerified: true,
    });
    if (!user || !user?.recoveryCodes.length) throw new HttpException({ message: WaitingListErrorMessages.INVALID_CODE }, HttpStatus.BAD_REQUEST);

    let doesPasswordMatch = false;
    let matchedRecoveryCodeId = null;

    try {
      for await (const hashedCode of user.recoveryCodes) {
        const isMatch = await bcrypt.compare(recoveryCode, hashedCode.code);

        if (isMatch && !hashedCode.isUsed) {
          doesPasswordMatch = true;
          matchedRecoveryCodeId = hashedCode._id;
          break;
        }
      }

      if (!doesPasswordMatch) {
        throw new Error('Recovery code is invalid or is already used');
      }
    } catch (error) {
      throw new HttpException({ message: error.message || WaitingListErrorMessages.INVALID_CODE }, HttpStatus.BAD_REQUEST);
    }

    this.waitingListRepo.updatedWaitingListUser(
      {
        email,
        qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
        isMfaAdded: true,
        isEmailVerified: true,
        'recoveryCodes._id': matchedRecoveryCodeId,
      },
      { 'recoveryCodes.$.isUsed': true } as any,
    );
    const payload: any = {
      id: user.id,
      email: user.email,
      role: Role.PRACTITIONER,
      logInTime: Date.now(),
    };
    const sessionId = crypto.randomUUID();
    payload.sessionId = sessionId;
    const token = this.jwtService.sign(payload);
    this.waitingListRepo.updatedWaitingListUser(
      {
        email,
      },
      { $push: { sessionIds: sessionId } },
    );
    const permissions = await this.userRepo.getPermissions(Role.PRACTITIONER);

    this.triggerEvent(
      {
        ...user,
        role: Role.PRACTITIONER,
      },
      req,
      'logged in by verifying otp',
    );
    return this.response.success({
      token,
      permissions,
      recoveryCodes: [],
      id: user.id,
    });
  }

  private generateRecoveryCodes(): { code: string }[] {
    const recoveryCodes = [];
    for (let i = 0; i < 10; i++) {
      recoveryCodes.push({
        code: `${this.randRecoveryCodeWithout_0o()}-${this.randRecoveryCodeWithout_0o()}`,
      });
    }
    return recoveryCodes;
  }

  private async generateHashRecoveryCodes(recoveryCodes: { code: string }[]) {
    const hashedRecoveryCodes = [];
    for await (const recoveryCode of recoveryCodes) {
      const hashedCode = await bcrypt.hash(recoveryCode.code.toString(), authConfig.salt);
      hashedRecoveryCodes.push({
        code: hashedCode,
      });
    }
    return hashedRecoveryCodes;
  }

  private randRecoveryCodeWithout_0o = (): string => {
    let result = '';
    const buffer = crypto.randomBytes(5);

    for (let i = 0; i < 5; i++) {
      const index = buffer[i] % chars.length;
      result += chars[index];
    }
    return result.toLowerCase();
  };

  private triggerEvent(user: any, req: Request, description: string, resultType?: string) {
    const { originalUrl, headers, method } = req;
    this.eventEmitter.emit('audit.log', {
      actor: {
        ...user,
        ip: getIpAddress(req),
        url: originalUrl,
        device: headers['user-agent'],
        method,
        event: 'Authentication',
      },
      description,
      resultType: resultType || AuditLogResultType.POSITIVE,
      ...(resultType === AuditLogResultType.CONFUSED && {
        secondFactor: user?.phone,
      }),
    });
  }

  private async sendLoginNotificationEmail(email: string, data: any, req: Request) {
    try {
      const templatePath = 'src/helper/templates/new-login-alert.html';
      const template = fs.readFileSync(templatePath, 'utf8');
      const html = ejs.render(template, {
        device: data?.device,
        timezone: data?.timezone,
        ip: getIpAddress(req),
      });

      await this.mailService.sendMail(email, 'Account Security Notification', 'Account Security Notification', html);
    } catch (error) {
      console.error('Error sending login notification email:', error);
    }
  }
}
