import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { authConfig } from 'config/auth';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwt_key,
    });
  }

  async validate(payload: any) {
    if (payload === null) {
      throw new UnauthorizedException('Sorry! You are not a valid user for this action.');
    }
    return { ...payload };
  }
}
