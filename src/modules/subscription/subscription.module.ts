import { Module } from '@nestjs/common';
import { SubscriptionRepository } from './repository/subscription.repository';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionRepository, StripeService],
})
export class SubscriptionModule {}
