import { model, Schema } from 'mongoose';
import { SubscriptionEntity, SubscriptionStatus } from 'src/entity/subscription.entity';

const SubscriptionSchema = new Schema<SubscriptionEntity>(
  {
    priceId: {
      type: String,
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    practitionerId: {
      type: String,
      required: true,
      index: true,
    },
    customerId: String,
    productId: String,
    subscriptionId: {
      type: String,
      index: true,
    },
    expireTime: Date,
    cardLast4: String,
    cardExpMonth: Number,
    cardExpYear: Number,
    amount: Number,
    cardBrand: String,
    interval: String,
    status: {
      type: String,
      enum: SubscriptionStatus,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const SubscriptionModel = model<SubscriptionEntity>('subscription', SubscriptionSchema);
export { SubscriptionModel };
