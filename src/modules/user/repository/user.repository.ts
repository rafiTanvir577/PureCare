import { FilterQuery, Types } from 'mongoose';
import { InvitationType, Role } from './../../../entity/role.entity';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entity';
import { Invitation } from 'src/entity/invitation.model';
import { InvitationModel } from 'src/modules/admin/repository/invite.model';
import { UserModel } from './user.model';
import { RoleModel } from 'src/modules/role/repositories/role.model';
import { FeatureModel } from 'src/modules/role/repositories/feature.model';
import { Pagination } from 'src/helper/responseService/service.response.interface';
import { FileTypes } from 'src/entity/file.upload.entity';
import { FileModel } from 'src/modules/media/repository/file.model';

@Injectable()
export class UserRepository {
  async createUser(user: Partial<User>): Promise<User | null> {
    try {
      const createdUser = await UserModel.create(user);
      const newUser = createdUser?.toJSON();
      delete newUser?.password;
      return newUser;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async findAllUser(query: Record<string, any>): Promise<User[] | null> {
    return await UserModel.find(query).lean().select('-_id -setPasswordToken -password -resetPasswordToken');
  }

  async findAdmins(admins: any): Promise<User[] | null> {
    try {
      return await UserModel.find({
        id: { $in: admins },
      }).select('profile id email status');
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async findUser(query: FilterQuery<User>): Promise<User | null> {
    return await UserModel.findOne(query).lean().select('-_id');
  }

  async updateUser(filter: Record<string, any>, user: Record<string, any>): Promise<User | null> {
    return await UserModel.findOneAndUpdate(filter, user, { new: true }).lean().select('-password -_id').exec();
  }

  async deleteUser(query: Record<string, any>): Promise<User | null> {
    return await UserModel.findOneAndRemove(query).select('-_id').lean();
  }

  async findSignupInvitation(req: Record<string, any>): Promise<Invitation | null> {
    try {
      const invitationExists = await InvitationModel.findOne({
        email: req?.email,
        type: InvitationType.ADD_USER,
        isValid: true,
      })
        .lean()
        .exec();
      if (!invitationExists) return null;

      const validToken = await bcrypt.compare(req?.token, invitationExists?.token);
      if (!validToken) return null;

      return invitationExists;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async updateInvitation(req: Record<string, any>): Promise<Invitation | null> {
    try {
      return await InvitationModel.findOneAndUpdate(
        {
          email: req?.email,
          type: req?.type,
          isValid: true,
        },
        {
          isValid: false,
        },
        {
          new: true,
        },
      );
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async getInvitation(email: string, type: InvitationType): Promise<Invitation | null> {
    try {
      return await InvitationModel.findOne({
        email,
        type,
        isValid: true,
      })
        .select('-token')
        .lean()
        .exec();
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async getPermissions(roleName: string): Promise<any> {
    const role = await RoleModel.findOne({
      name: roleName,
    }).lean();

    return this.getFeatures(role?.features || []);
  }

  async getFeatures(features: Types.ObjectId[]): Promise<any> {
    return await FeatureModel.aggregate([
      {
        $match: { _id: { $in: features } },
      },
      {
        $addFields: {
          'subMenu.title': '$subMenu.subMenuTitle',
          'subMenu.image': '$subMenu.subMenuImage',
          'subMenu.id': '$subMenu.subMenuId',
          'subMenu.url': '$subMenu.subMenuUrl',
          'subMenu.type': '$subMenu.subMenuType',
        },
      },
      {
        $group: {
          _id: '$subMenu.subMenuId',
          menuId: { $first: '$menuId' },
          menuType: { $first: '$menuType' },
          menuTitle: { $first: '$menuTitle' },
          menuImage: { $first: '$menuImage' },
          menuUrl: { $first: '$menuUrl' },
          order: { $first: '$order' },
          subMenu: { $first: '$subMenu' },
          actions: { $addToSet: '$action' },
        },
      },
      { $sort: { order: 1, 'subMenu.order': 1 } },
      {
        $addFields: {
          'subMenu.action': '$actions',
        },
      },
      {
        $group: {
          _id: '$menuId',
          menuId: { $first: '$menuId' },
          menuType: { $first: '$menuType' },
          menuTitle: { $first: '$menuTitle' },
          menuImage: { $first: '$menuImage' },
          menuUrl: { $first: '$menuUrl' },
          order: { $first: '$order' },
          subMenus: { $push: '$subMenu' },
        },
      },
      { $sort: { order: 1 } },
      {
        $addFields: {
          url: {
            $cond: {
              if: { $ne: ['$menuUrl', null] },
              then: '$menuUrl',
              else: '$$REMOVE',
            },
          },
          id: '$menuId',
          title: '$menuTitle',
          type: '$menuType',
          image: '$menuImage',
        },
      },
      {
        $project: {
          _id: 0,
          menuId: 0,
          menuTitle: 0,
          menuImage: 0,
          menuType: 0,
          menuUrl: 0,
          'subMenus.subMenuId': 0,
          'subMenus.subMenuTitle': 0,
          'subMenus.subMenuImage': 0,
          'subMenus.subMenuType': 0,
          'subMenus.subMenuUrl': 0,
        },
      },
    ]);
  }

  async updateUserAdmins({ id, adminId }: Record<string, any>): Promise<any> {
    try {
      return await UserModel.findOneAndUpdate(
        {
          id,
          role: Role.CLIENT,
        },
        {
          $addToSet: {
            admins: adminId,
          },
        },
        {
          new: true,
        },
      ).lean();
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async checkValidInvitation(req: Record<string, any>): Promise<Invitation | null> {
    try {
      const invitation = await InvitationModel.findOne({
        email: req?.email,
        type: req?.type,
        isValid: true,
      })
        .lean()
        .exec();

      if (!invitation) return null;

      if (invitation?.expiration < Date.now()) return null;
      const validToken = await bcrypt.compare(req?.token, invitation?.token);

      if (!validToken) return null;

      return invitation;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async getProfile(id: string): Promise<User | null> {
    try {
      return await UserModel.findOne({ id }).select(' -_id id firstName lastName email status createdAt profile').lean();
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async findReports(req: { adminId?: string; user: string }, pagination: Pagination): Promise<any> {
    try {
      return await FileModel.aggregate([
        {
          $match: {
            ...(req?.adminId && { admin: req?.adminId }),
            user: req?.user,
            type: FileTypes.REPORT,
          },
        },
        {
          $project: {
            uploadId: '$_id',
            files: '$fileAttributes',
            _id: 0,
            createdAt: 1,
          },
        },
        {
          $unwind: '$files',
        },
        {
          $addFields: {
            status: 'Uploaded',
            name: '$files.originalName',
            fileId: '$files._id',
            uploadTime: '$createdAt',
          },
        },
        {
          $project: {
            createdAt: 0,
            files: 0,
          },
        },
        { $skip: +pagination?.page },
        { $limit: +pagination?.limit },
      ]);
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async countTotalReports(req: { adminId?: string; user: string }): Promise<number> {
    const response = await FileModel.aggregate([
      {
        $match: {
          ...(req?.adminId && { admin: req?.adminId }),
          user: req?.user,
          type: FileTypes.REPORT,
        },
      },
      {
        $unwind: '$fileAttributes',
      },
      { $count: 'totalCount' },
    ]);

    return response?.[0]?.totalCount || 0;
  }

  async getFiles(user: string): Promise<{ name: string; fileId: string }[] | null> {
    try {
      return await FileModel.aggregate([
        {
          $match: { user },
        },
        {
          $project: {
            _id: 0,
            fileAttributes: 1,
          },
        },
        {
          $unwind: '$fileAttributes',
        },
        {
          $addFields: {
            name: '$fileAttributes.originalName',
            fileId: 'fileAttributes._id',
          },
        },
        {
          $project: {
            fileAttributes: 0,
          },
        },
      ]);
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
