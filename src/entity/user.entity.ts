import { Types } from 'mongoose';
import { DataEntryRole, Role } from './role.entity';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DataEntryUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class User {
  id?: string;
  email: string;
  password?: string;
  role: Role;
  profile?: object;
  resetPasswordToken?: string;
  resetPasswordExpires?: number;
  features?: Types.ObjectId[];
  admins?: string[];
  firstName?: string;
  lastName?: string;
  status?: UserStatus;
  setPasswordStatus?: string;
  fileId?: Types.ObjectId;
  invitationDate?: Date;
  comment?: string;
  setPasswordExpirationTime?: number;
  setPasswordToken?: string;
  isEmailVerified?: boolean;
  sessionId?: string;
  deviceTokens?: string[];
  emailVerificationToken?: string;
  emailVerificationExpireTime?: number;
  tmpEmail?: string;
}

export interface AddUserRequest {
  email: string;
  role: DataEntryRole;
  profile: {
    image?: string;
  };
  firstName: string;
  lastName: string;
}

export enum ClientStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
}

export class CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export class LoginRequest {
  email: string;
  password: string;
  deviceToken: string;
  metaData: any;
}

export class UpdateUserRequest {
  email?: string;
  profile: object;
}

export class ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class Token {
  token: string;
}

export enum UserAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class UpdateAdminRequest {
  status: UserAction;
  comment?: string;
}
