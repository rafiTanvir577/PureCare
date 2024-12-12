import { Role } from './role.entity';

export class UserJwtPayload {
  id: string;
  email: string;
  admins?: string[];
  logInTime: number;
  role: string;
  sessionId?: string;
}

export class LoginAttempt {
  email: string;
  role: Role;
  deviceToken?: string;
  isSuccess?: boolean;
  ip?: string;
  platform?: string;
  timezone?: string;
}

export class ForgotPasswordRequest {
  email: string;
}

export class ResetPasswordRequest {
  password: string;
}
