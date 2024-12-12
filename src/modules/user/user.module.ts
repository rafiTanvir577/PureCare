import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UserRepository } from './repository/user.repository';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { authConfig } from 'config/auth';
import { JwtStrategy } from 'src/guards/jwt.strategy';
import { DataEntryUserController } from './data-entry-user.controller';
import { WaitingListHelper } from '../waiting-list/waiting-list.helper';

@Module({
  imports: [
    JwtModule.register({
      secret: authConfig.jwt_key,
      signOptions: {
        expiresIn: authConfig.expiration_time,
      },
    }),
  ],
  controllers: [UserController, DataEntryUserController],
  providers: [UserService, UserRepository, JwtStrategy, WaitingListHelper],
})
export class UserModule {}
