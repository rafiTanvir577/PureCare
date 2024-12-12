import { JwtStrategy } from './../../guards/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { UserRepository } from '../user/repository/user.repository';
import { AuthController } from './auth.controller';
import { AuthenticationService } from './auth.service';
import { authConfig } from 'config/auth';
import { MailService } from '@sendgrid/mail';
import { WaitingListRepository } from '../waiting-list/repository/waiting-list.repository';
import { SMSService } from 'src/helper/smsService';
import { LoginAttemptRepository } from './repository/login-attempts.repository';

@Module({
  imports: [
    JwtModule.register({
      secret: authConfig.jwt_key,
      signOptions: {
        expiresIn: authConfig.expiration_time,
      },
    }),
    MailService,
  ],
  controllers: [AuthController],
  providers: [AuthenticationService, UserRepository, JwtStrategy, MailService, WaitingListRepository, SMSService, LoginAttemptRepository],
})
export class AuthModule {}
