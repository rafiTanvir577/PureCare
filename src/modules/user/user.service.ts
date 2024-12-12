import { Pagination } from './../../helper/responseService/service.response.interface';
import { Invitation } from 'src/entity/invitation.model';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authConfig } from 'config/auth';

import { AddUserRequest, ChangePasswordRequest, DataEntryRole, InvitationType, Role, SignupByInvitationRequest, Token, UpdateUserRequest, User, UserJwtPayload, UserStatus } from 'src/entity';
import { APIResponse, IResponse } from 'src/internal/api-response/api-response.service';
import { UserRepository } from './repository/user.repository';
import { Types } from 'mongoose';
import base64url from 'base64url';
import { FileResponse } from 'src/entity/file.upload.entity';
import { WaitingListEmailType } from 'src/entity/waiting-list.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogResultType } from 'src/entity/audit.entity';
import { S3FileUploadService } from 'src/helper/s3Service';
import { coreConfig } from 'config/core';

@Injectable()
export class UserService {
  constructor(private userRepo: UserRepository, private readonly response: APIResponse, private jwtService: JwtService, private readonly waitingListHelper: WaitingListHelper, private eventEmitter: EventEmitter2) {}

  async updateUser(userId: string, data: UpdateUserRequest, user: User): Promise<IResponse<User>> {
    const [profile, doesEmailExists] = await Promise.all([
      await this.userRepo.findUser({ id: userId }),
      data.email &&
        (await this.userRepo.findUser({
          email: data.email,
          id: { $ne: userId },
        })),
    ]);
    if (!profile || doesEmailExists)
      throw new HttpException(
        {
          message: doesEmailExists ? 'Email already exists' : 'Invalid User ID',
        },
        HttpStatus.BAD_REQUEST,
      );

    const { email, ...rest } = data;
    let updatedData: any = rest;
    const emailVerificationToken = crypto.randomUUID();
    if (email !== profile.email) {
      updatedData = {
        tmpEmail: data.email?.toLowerCase(),
        emailVerificationToken,
        emailVerificationExpireTime: Date.now() + +authConfig?.WAITING_USER_EMAIL_EXPIRATION * 24 * 3600000,
      };
    }
    const updatedUser = await this.userRepo.updateUser(
      { id: userId },
      {
        ...rest,
        ...updatedData,
      },
    );
    if (!updatedUser) throw new HttpException({ message: 'Could not update your profile' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not update your profile' });

    try {
      if (email !== profile.email) {
        const params = this.waitingListHelper.buildEncodedQueryParams(data.email, emailVerificationToken);
        const verifyEmailLink = coreConfig.baseUrl + `/api/data-entry-user/verify-new-email/${params}`;
        const template = fs.readFileSync('src/helper/templates/verification.html', 'utf8');

        this.waitingListHelper.sendEmail(data.email, WaitingListEmailType.VERIFY_EMAIL, template, verifyEmailLink);
      }
    } catch (err) {
      console.log(err);
    }
    if ((updatedUser?.profile as any)?.image) {
      (updatedUser.profile as any).image = await this.addS3Url((updatedUser.profile as any).image);
    }
    this.triggerEvent(user, 'updated own information', data);
    return this.response.success(updatedUser);
  }

  async verifyNewEmail(token: string): Promise<any> {
    try {
      const { email, token: emailVerificationToken } = this.waitingListHelper.decodeQueryParams(token);

      const user = await this.userRepo.findUser({
        tmpEmail: email,
        emailVerificationToken,
        emailVerificationExpireTime: { $gt: Date.now() },
      });
      if (!user) throw new Error('Token is expired');

      const updatedUser = await this.userRepo.updateUser(
        {
          id: user.id,
        },
        {
          email,
          tmpEmail: null,
        },
      );
      if (!updatedUser) throw new Error('Failed to update the new email');

      return this.response.success({
        message: 'Verified email successfully',
      });
    } catch (err) {
      throw new HttpException({ message: err.message || 'Failed to verify the new email' }, HttpStatus.BAD_REQUEST);
    }
  }

  async changePassword(user: User, passwordRequest: ChangePasswordRequest): Promise<IResponse<{ message: string }>> {
    const { currentPassword, newPassword } = passwordRequest;
    const userInfo = await this.userRepo.findUser({ id: user.id });
    if (!userInfo) throw new HttpException({ message: 'Invalid User Data' }, HttpStatus.BAD_REQUEST, { description: 'Invalid User Data' });

    const doesPasswordMatch = await bcrypt.compare(currentPassword, userInfo.password);
    if (!doesPasswordMatch) throw new HttpException({ message: 'Incorrect User Password' }, HttpStatus.BAD_REQUEST, { description: 'Incorrect User Password' });

    const password = await bcrypt.hash(newPassword, authConfig.salt);

    const updatedUser = await this.userRepo.updateUser({ id: user.id }, { password });
    if (!updatedUser) throw new HttpException({ message: 'Could not update your password' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not update your password' });

    this.triggerEvent(user, 'changed own password');
    return this.response.success({
      message: 'Successfully changed your password',
    });
  }

  async getAllUser(query?: any): Promise<IResponse<User>> {
    if (query?.dataEntry) {
      delete query.dataEntry;
      query = {
        ...query,
        $or: [{ role: Role.DATA_OPERATOR }, { role: Role.DATA_SUPERVISOR }],
      };
    }
    const users = await this.userRepo.findAllUser(query || {});
    if (!users) throw new HttpException({ message: 'Invalid Request' }, HttpStatus.BAD_REQUEST, { description: 'Invalid Request' });

    for await (const user of users) {
      if ((user?.profile as any)?.image) {
        (user.profile as any).image = await this.addS3Url((user.profile as any).image);
      }
    }
    return this.response.success(users);
  }

  async getUser(query: Record<string, any>): Promise<IResponse<User>> {
    if (query?.dataEntry) {
      delete query.dataEntry;
      query = {
        ...query,
        $or: [{ role: Role.DATA_OPERATOR }, { role: Role.DATA_SUPERVISOR }],
      };
    }
    const user = await this.userRepo.findUser(query);
    if (!user) throw new HttpException({ message: 'Invalid Request' }, HttpStatus.BAD_REQUEST, { description: 'Invalid Request' });

    if ((user?.profile as any)?.image) {
      (user.profile as any).image = await this.addS3Url((user.profile as any).image);
    }
    return this.response.success(user);
  }

  async deleteUser(userId: string): Promise<IResponse<{ message: string }>> {
    const response = await this.userRepo.deleteUser({ id: userId });

    if (!response) throw new HttpException({ message: 'Invalid ID' }, HttpStatus.BAD_REQUEST, { description: 'Invalid Request' });

    return this.response.success({ message: 'Successfully deleted user' });
  }

  async signupByInvitation(token: string, req: SignupByInvitationRequest): Promise<IResponse<Token>> {
    const invitationExists = await this.userRepo.findSignupInvitation({
      ...req,
      token,
    });

    const userExists = await this.userRepo.findUser({
      email: invitationExists?.email,
    });
    if (userExists) throw new HttpException({ message: 'User Already exists' }, HttpStatus.BAD_REQUEST, { description: 'User Already exists' });

    if (!invitationExists) throw new HttpException({ message: 'Invalid Credentials' }, HttpStatus.BAD_REQUEST, { description: 'Invalid Credentials' });

    if (invitationExists?.expiration < Date.now()) throw new HttpException({ message: 'link Expired' }, HttpStatus.BAD_REQUEST, { description: 'link Expired' });
    //@ts-ignore
    const invitationDate = invitationExists?.updatedAt;

    const updateInvitation = await this.userRepo.updateInvitation({
      ...req,
      type: InvitationType.ADD_USER,
      token,
    });
    if (!updateInvitation) throw new HttpException({ message: 'Could not update invitation' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not update invitation' });

    const hashedPassword = await bcrypt.hash(req?.password, authConfig?.salt);
    const user = {
      ...req,
      invitationDate,
      password: hashedPassword,
      role: invitationExists?.role,
      ...(invitationExists?.admin && { admins: [invitationExists?.admin] }),
      ...(invitationExists?.features && {
        features: invitationExists?.features.map((feature) => new Types.ObjectId(feature)),
      }),
    };

    const newUser = await this.userRepo.createUser(user);
    if (!newUser) throw new HttpException({ message: 'Could not create user' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not create user' });

    const payload: UserJwtPayload = {
      id: newUser?.id,
      email: newUser?.email,
      role: newUser?.role,
      logInTime: Date.now(),
    };

    const loginToken = this.jwtService.sign(payload);
    const permissions = newUser?.role === Role.CLIENT ? await this.userRepo.getPermissions(newUser?.role) : await this.userRepo.getFeatures(user?.features);

    return this.response.success(
      {
        permissions,
        role: newUser?.role,
        id: newUser?.id,
        token: loginToken,
      },
      { message: 'User signup successful' },
    );
  }

  async getSignupInvitationStatus(email: string): Promise<IResponse<Invitation>> {
    const invitationExists = await this.userRepo.getInvitation(email, InvitationType.ADD_USER);
    return this.checkInvitationValidity(invitationExists);
  }

  async getFileUploadInvitationStatus(email: string): Promise<IResponse<Invitation>> {
    const invitationExists = await this.userRepo.getInvitation(email, InvitationType.FILE_UPLOAD);
    return this.checkInvitationValidity(invitationExists);
  }

  async updateUserAdmins(req: Record<string, any>): Promise<IResponse<{ updatedUser: User }>> {
    const adminExists = await this.userRepo.findUser({
      role: Role.ADMIN,
      id: req?.adminId,
    });

    if (!adminExists) throw new HttpException({ message: 'Invalid admin id' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Invalid admin id' });

    const updatedUser = await this.userRepo.updateUserAdmins(req);
    if (!updatedUser) throw new HttpException({ message: 'Invalid client id or only clients can be updated' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Invalid client id or only clients can be updated' });

    return this.response.success({ updatedUser });
  }

  async acceptInvitaion(token: string): Promise<IResponse<{ fileUploadLink: string }>> {
    const urlParam = Buffer.from(base64url.decode(token)).toString('utf8');

    const query = {};
    query['email'] = urlParam.split('&')[0].split('=')[1];
    query['token'] = urlParam.split('&')[1].split('=')[1];
    query['type'] = InvitationType.FILE_UPLOAD;

    const validInvitation = await this.userRepo.checkValidInvitation(query);
    if (!validInvitation) throw new HttpException({ message: 'Invalid token or link expired' }, HttpStatus.BAD_REQUEST, { description: 'Invalid token or link expired' });

    //check if the admin exists in that user db
    const adminExists = await this.userRepo.findUser({
      role: Role.ADMIN,
      id: validInvitation?.admin,
      status: UserStatus.APPROVED,
    });

    if (!adminExists) throw new HttpException({ message: 'Invalid admin id' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Invalid admin id' });

    const updatedUser = await this.userRepo.updateUserAdmins({
      id: validInvitation?.userId,
      adminId: validInvitation?.admin,
    });

    if (!updatedUser) throw new HttpException({ message: 'Clients could not be updated' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Clients could not be updated' });

    const fileUploadLink = authConfig?.pc_ADMIN_BASE_URL + authConfig?.FILE_UPLOAD_INVITE_URL;

    return this.response.success({ fileUploadLink });
  }

  async getAdmins(id: string): Promise<IResponse<{ admins: User[] }>> {
    const user = await this.userRepo.findUser({ id, role: Role.CLIENT });
    if (!user) throw new HttpException({ message: 'Could not get user details' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not get user details' });

    const { admins } = user;
    const adminDetails = await this.userRepo.findAdmins(admins);

    if (!adminDetails) throw new HttpException({ message: 'Could not get admins' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not get admins' });

    return this.response.success({ admins: adminDetails });
  }

  async getProfile(user: User): Promise<IResponse<User>> {
    const profile = await this.userRepo.getProfile(user.id);

    if (!profile) throw new HttpException({ message: 'Invlaid id' }, HttpStatus.BAD_REQUEST, { description: 'Invlaid id' });

    this.triggerEvent(user, 'viewed own profile information');
    return this.response.success({
      ...profile,
      files: await this.userRepo.getFiles(user.id),
    });
  }

  async getFileList(req: { adminId?: string; user: string }, pagination: Pagination): Promise<IResponse<FileResponse>> {
    pagination.page = (pagination?.page - 1) * pagination?.limit;

    const fileList = await this.userRepo.findReports(req, pagination);
    if (!fileList) throw new HttpException({ message: 'Could not fetch file list' }, HttpStatus.INTERNAL_SERVER_ERROR, { description: 'Could not fetch file list' });

    const totalReports = await this.userRepo.countTotalReports(req);

    return this.response.success(fileList, {
      pageCount: Math.ceil(totalReports / pagination?.limit),
    });
  }

  //private function
  checkInvitationValidity(invitation: Invitation) {
    if (!invitation) throw new HttpException({ message: 'Invalid email or no invitaion link for this email' }, HttpStatus.BAD_REQUEST, { description: 'Invalid email or no invitaion link for this email' });

    if (invitation?.expiration < Date.now()) throw new HttpException({ message: 'Link expired' }, HttpStatus.BAD_REQUEST, { description: 'Link expired' });

    return this.response.success(invitation);
  }

  async addUser(ownerId: string, data: AddUserRequest): Promise<IResponse<User>> {
    const [user, owner] = await Promise.all([
      await this.userRepo.findUser({
        email: data.email?.toLowerCase(),
      }),
      await this.userRepo.findUser({
        id: ownerId,
        role: Role.OWNER,
      }),
    ]);
    if (user) throw new HttpException({ message: 'Email Already exists' }, HttpStatus.BAD_REQUEST);

    data.email = data.email?.toLowerCase();
    const setPasswordToken = crypto.randomUUID();
    const addedUser = await this.userRepo.createUser({
      ...data,
      email: data.email,
      setPasswordToken,
      setPasswordExpirationTime: Date.now() + +authConfig?.DATA_ENTRY_USER_SET_PASSWORD_EXPIRATION * 24 * 3600000,
    } as any);
    if (!addedUser) throw new HttpException({ message: 'Could not add your profile' }, HttpStatus.BAD_REQUEST);

    try {
      const params = this.waitingListHelper.buildEncodedQueryParams(data.email, setPasswordToken);
      const setPasswordEmailLink = authConfig?.pc_ADMIN_BASE_URL + `/data-entry/reset-password?token=${params}`;

      const setPasswordTemplate = fs.readFileSync('src/helper/templates/data-entry-set-password.html', 'utf8');
      const fullName = owner.firstName && owner.lastName ? owner.firstName + ' ' + owner.lastName : 'Owner';
      const role = data.role === DataEntryRole.DATA_OPERATOR ? 'Data Operator' : 'Data Supervisor';
      this.waitingListHelper.sendEmail(data.email, `You have been added by ${fullName} as a ${role} at pc` as any, setPasswordTemplate, setPasswordEmailLink, {
        owner: fullName,
      });
    } catch (error) {
      console.log(error);
    }
    return this.response.success(addedUser);
  }

  async setPassword(token: string, data: { password: string }): Promise<IResponse<User>> {
    try {
      const { email, token: setPasswordToken } = this.waitingListHelper.decodeQueryParams(token);
      data.password = await bcrypt.hash(data.password, authConfig.salt);

      const user = await this.userRepo.updateUser(
        {
          email,
          setPasswordToken,
          setPasswordExpirationTime: { $gt: Date.now() },
        },
        {
          password: data.password,
          isEmailVerified: true,
          setPasswordExpirationTime: null,
          setPasswordToken: null,
          setPasswordStatus: null,
        },
      );
      if (!user) throw new Error();
      return this.response.success(user);
    } catch (error) {
      throw new HttpException({ message: 'Invalid Token' }, HttpStatus.BAD_REQUEST);
    }
  }

  async changePasswordEmail(id: string): Promise<IResponse<{ message: string }>> {
    const setPasswordToken = crypto.randomUUID();
    const user = await this.userRepo.updateUser(
      { id },
      {
        setPasswordToken,
        setPasswordExpirationTime: Date.now() + +authConfig?.DATA_ENTRY_USER_SET_PASSWORD_EXPIRATION * 24 * 3600000,
      },
    );
    if (!user) throw new HttpException({ message: 'Invalid User Id' }, HttpStatus.BAD_REQUEST);

    try {
      const params = this.waitingListHelper.buildEncodedQueryParams(user.email, setPasswordToken);
      const setPasswordEmailLink = authConfig?.pc_ADMIN_BASE_URL + `/data-entry/reset-password?token=${params}`;

      const setPasswordTemplate = fs.readFileSync('src/helper/templates/reset-password.html', 'utf8');
      this.waitingListHelper.sendEmail(user.email, WaitingListEmailType.CHANGE_PASSWORD, setPasswordTemplate, setPasswordEmailLink);
    } catch (error) {
      console.log(error);
    }

    return this.response.success({
      message: 'Successfully send mail',
    });
  }

  async addS3Url(file: string): Promise<string> {
    if (file ?? '' !== '') {
      file = await new S3FileUploadService().generatePreSignedUrl(file, '');
    }
    return file;
  }

  private triggerEvent(user: any, description: string, changes?: object) {
    this.eventEmitter.emit('audit.log', {
      actor: {
        ...user,
        event: 'User',
      },
      description,
      resultType: AuditLogResultType.POSITIVE,
      changes,
    });
  }
}
