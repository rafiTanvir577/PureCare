import { Injectable } from '@nestjs/common';
import { FilterQuery } from 'mongoose';
import { SubscriptionEntity } from 'src/entity/subscription.entity';
import { SubscriptionModel } from './subscription.model';
import { WaitingListUser } from 'src/entity/waiting-list.entity';
import { WaitingListModel } from 'src/modules/waiting-list/repository/waiting-list.model';

@Injectable()
export class SubscriptionRepository {
  async createNewSubscription(subscription: SubscriptionEntity): Promise<SubscriptionEntity | null> {
    try {
      return await SubscriptionModel.create(subscription);
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async findSubscription(filter: FilterQuery<SubscriptionEntity>): Promise<SubscriptionEntity> {
    return await SubscriptionModel.findOne(filter).lean();
  }

  async findPractitionerInfo(filter: Record<string, any>): Promise<WaitingListUser> {
    return await WaitingListModel.findOne(filter).lean();
  }

  async updateSubscription(filter: FilterQuery<SubscriptionEntity>, data: Partial<SubscriptionEntity>): Promise<SubscriptionEntity> {
    return await SubscriptionModel.findOneAndUpdate(filter, {
      $set: data,
    }).lean();
  }
}
