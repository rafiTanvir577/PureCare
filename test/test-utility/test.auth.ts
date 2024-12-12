import { JwtService } from '@nestjs/jwt';
import { authConfig } from 'config/auth';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  admins?: string[];
  logInTime: number;
}

export interface JwtTokenRes {
  token: string;
}

const CreateJwtPayloadForUserToken = (id: string, email: string, role: string, admins: string[] = null): JwtPayload => {
  return {
    id,
    email,
    role,
    admins,
    logInTime: Date.now(),
  };
};

export const GetTestUserLoginToken = (id: string, email: string, role: string, sessionId?: string, admins: string[] = null): JwtTokenRes => {
  const jwtService = new JwtService({
    secret: authConfig.jwt_key,
    signOptions: {
      expiresIn: authConfig.expiration_time,
    },
  });
  const payload = CreateJwtPayloadForUserToken(id, email, role, admins);
  if (sessionId) {
    (payload as any).sessionId = sessionId;
  }
  const token = jwtService.sign(payload);
  return { token };
};
