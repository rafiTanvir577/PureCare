import { InvitationType } from '../entity/role.entity';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InvitationModel } from 'src/modules/admin/repository/invite.model';
import { UserModel } from 'src/modules/user/repository/user.model';

@Injectable()
export class ClientFileUploaderValidatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const { params, user } = req;
    const { adminId } = params;

    return this.validateRequest(req, user, adminId);
  }

  async validateRequest(request: Request, user: any, adminId: string): Promise<boolean> {
    //check if the user is valid for that admin
    const validAdmin = await UserModel.findOne({
      id: user?.id,
      admins: adminId,
    }).lean();

    if (!validAdmin) throw new UnauthorizedException('Sorry! You are not authorized to upload file under this admin');

    //check if the invitaiton is valid
    const validUserForToken = await InvitationModel.findOne({
      email: user?.email,
      type: InvitationType.FILE_UPLOAD,
      admin: adminId,
      isValid: true,
    })
      .lean()
      .exec();

    if (!validUserForToken) throw new UnauthorizedException('Sorry! You dont have any invitation for file upload with this email');

    //check if invitation expired
    if (validUserForToken.expiration < Date.now()) throw new BadRequestException('Invitation link Expired');

    request['fileDetails'] = {
      user: user?.id,
      admin: adminId,
    };

    return true;
  }
}
