export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCEL = 'cancel',
}

export class SubscriptionEntity {
  priceId: string;
  sessionId: string;
  practitionerId: string;
  customerId?: string;
  productId?: string;
  subscriptionId?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  amount?: number;
  expireTime?: Date;
  interval?: string;
  status?: SubscriptionStatus;
}
