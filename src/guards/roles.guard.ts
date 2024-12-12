import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from 'src/decorators/permission.decorator';
import { PERMISSIONS } from 'src/entity/permissions.enum';
import { Role } from 'src/entity/role.entity';
import { RoleRepository } from '../modules/role/repositories/role.repository';
import { LoginErrorMessage, UserStatus } from 'src/entity';
import { DeActiveWaitingListModel, WaitingListModel } from 'src/modules/waiting-list/repository/waiting-list.model';
import { UserModel } from 'src/modules/user/repository/user.model';
import { getIpAddress } from 'src/helper/utils/ip';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<PERMISSIONS>(PERMISSION_KEY, context.getHandler());
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user, originalUrl, headers, method } = request;
    if (!user) {
      throw new UnauthorizedException('Sorry! You are not a valid user for this action.');
    }
    user.ip = getIpAddress(request);
    user.url = originalUrl;
    user.device = headers['user-agent'];
    user.method = method;
    user.event = context.getClass().name || 'UnknownController';

    const { role, id } = user;
    let features: Types.ObjectId[] = [];
    switch (role) {
      case Role.PRACTITIONER:
        const [practitioner, deActivePractitioner] = await Promise.all([await WaitingListModel.findOne({ id }).lean(), await DeActiveWaitingListModel.findOne({ id }).lean()]);
        if (!practitioner || deActivePractitioner) {
          throw new UnauthorizedException(deActivePractitioner ? 'Account error. Please contact us for help.' : 'Sorry! You are ineligible to perform this activity');
        } else if (!practitioner?.sessionIds?.find((session) => session === user.sessionId)) {
          throw new UnauthorizedException(LoginErrorMessage.ACCOUNT_ERROR);
        }
        user.firstName = practitioner.firstName;
        user.lastName = practitioner.lastName;
        features = await RoleRepository.getFeatures(role);
        break;

      case Role.DATA_OPERATOR:
      case Role.DATA_SUPERVISOR:
        const dataEntryUser = await UserModel.findOne({
          id,
          role,
        });
        if (dataEntryUser?.status === UserStatus.INACTIVE) {
          throw new UnauthorizedException(LoginErrorMessage.ACCOUNT_ERROR);
        } else if (!dataEntryUser?.sessionId) {
          throw new UnauthorizedException('Sorry! You are ineligible to perform this activity');
        } else if (dataEntryUser?.sessionId !== user.sessionId) {
          throw new UnauthorizedException(LoginErrorMessage.ACCOUNT_ERROR);
        }
        user.firstName = dataEntryUser.firstName;
        user.lastName = dataEntryUser.lastName;
        features = await RoleRepository.getFeatures(role);

      default:
        const userInfo = await UserModel.findOne({ id }).lean();
        if (!userInfo) {
          throw new UnauthorizedException('User not found');
        }
        user.firstName = userInfo.firstName;
        user.lastName = userInfo.lastName;
        features = await RoleRepository.getFeatures(role);
        break;
    }

    if (!features || features?.length == 0) throw new UnauthorizedException('Sorry! This action is restricted.');

    const permissions = await RoleRepository.getPermissions(features);
    const hasPermission = permissions.some((r: string) => r === requiredPermission);
    if (!hasPermission) throw new UnauthorizedException('Sorry! This action is restricted.');

    return true;
  }
}
