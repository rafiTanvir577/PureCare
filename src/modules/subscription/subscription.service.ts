import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { APIResponse, IResponse } from 'src/internal/api-response/api-response.service';
import { SubscriptionRepository } from './repository/subscription.repository';
import { StripeService } from './stripe.service';
import { WaitingListUser } from 'src/entity/waiting-list.entity';
import { SubscriptionEntity, SubscriptionStatus } from 'src/entity/subscription.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
// import { AuditLogResultType } from 'src/entity/audit.entity';
import { stripeConfig } from 'config/stripe';

@Injectable()
export class SubscriptionService {
  constructor(private subscriptionRepo: SubscriptionRepository, private stripeService: StripeService, private readonly response: APIResponse, private eventEmitter: EventEmitter2) {}

  async createStripeRecurringSession(practitioner: WaitingListUser, priceId: string, quantity: number): Promise<IResponse<{ url: string }>> {
    const alreadyHaveSubscription = await this.subscriptionRepo.findSubscription({
      practitionerId: practitioner.id,
    });
    if (alreadyHaveSubscription?.subscriptionId && alreadyHaveSubscription?.status !== SubscriptionStatus.CANCEL) {
      const updatedSubscription = await this.updateSubscription(practitioner, { priceId, quantity });
      if (updatedSubscription) {
        return {
          url: stripeConfig.updatedUrl,
        };
      }
    }

    const session = await this.stripeService.createCheckoutSession(priceId, quantity, practitioner.id);
    const subscription = !alreadyHaveSubscription
      ? await this.subscriptionRepo.createNewSubscription({ priceId, sessionId: session.id, practitionerId: practitioner.id })
      : await this.subscriptionRepo.updateSubscription(
          {
            practitionerId: practitioner.id,
          },
          {
            priceId,
            sessionId: session.id,
          },
        );

    if (!subscription || !session?.url) {
      throw new HttpException({ message: 'Error in initializing stripe subscription' }, HttpStatus.BAD_REQUEST);
    }
    this.triggerEvent(practitioner, 'requested to initialize the stripe payment subscription', { priceId, quantity });
    return this.response.success({ url: session.url });
  }

  async cancelSubscription(practitioner: WaitingListUser): Promise<IResponse<{ message: string }>> {
    const subscription = await this.subscriptionRepo.findSubscription({
      practitionerId: practitioner.id,
    });
    if (!subscription || !subscription?.subscriptionId) {
      throw new HttpException({ message: 'Error in getting your subscription' }, HttpStatus.BAD_REQUEST);
    }

    const cancelSubscription = await this.stripeService.cancelSubscription(subscription.subscriptionId);
    if (!cancelSubscription) {
      throw new HttpException({ message: 'Error in canceling your subscription' }, HttpStatus.BAD_REQUEST);
    }
    await this.subscriptionRepo.updateSubscription(
      {
        practitionerId: practitioner.id,
      },
      {
        status: SubscriptionStatus.CANCEL,
      },
    );

    this.triggerEvent(practitioner, 'cancelled subscription');
    return this.response.success({
      message: 'Subscription canceled successfully',
    });
  }

  async getBillingInfo(practitioner: WaitingListUser): Promise<IResponse<SubscriptionEntity>> {
    const subscription = await this.subscriptionRepo.findSubscription({
      practitionerId: practitioner.id,
    });
    if (!subscription || !subscription?.productId || !subscription?.customerId || !subscription?.status) {
      return this.response.success({
        practitionerId: practitioner.id,
        priceId: null,
        sessionId: null,
        customerId: null,
        productId: null,
        subscriptionId: null,
        cardBrand: null,
        cardLast4: null,
        cardExpMonth: null,
        cardExpYear: null,
        amount: null,
        expireTime: null,
        interval: null,
        status: null,
      });
    }
    const plan = await this.stripeService.getProductPlan(subscription?.productId);

    this.triggerEvent(practitioner, 'viewed subscription billing information');
    return this.response.success({
      ...subscription,
      planName: plan?.name,
      planDescription: plan?.description,
    });
  }

  async updateSubscription(practitioner: WaitingListUser, data: { priceId: string; quantity: number }): Promise<IResponse<{ message: string }>> {
    const subscription = await this.subscriptionRepo.findSubscription({
      practitionerId: practitioner.id,
    });
    if (!subscription || !subscription?.subscriptionId) {
      throw new HttpException({ message: 'Error in getting your subscription' }, HttpStatus.BAD_REQUEST);
    }

    const updateSubscription = await this.stripeService.updateSubscription(subscription.subscriptionId, data.priceId, data.quantity);
    if (!updateSubscription) {
      throw new HttpException({ message: 'Error in updating your subscription' }, HttpStatus.BAD_REQUEST);
    }
    await this.subscriptionRepo.updateSubscription(
      {
        practitionerId: practitioner.id,
      },
      {
        priceId: data.priceId,
        status: SubscriptionStatus.ACTIVE,
        expireTime: new Date(updateSubscription.current_period_end * 1000),
        productId: updateSubscription?.plan?.product,
        amount: updateSubscription?.plan?.amount,
        interval: updateSubscription?.plan?.interval,
      },
    );

    this.triggerEvent(practitioner, 'updated subscription', data);
    return this.response.success({
      message: 'Subscription updated successfully',
    });
  }

  async getPaymentHistory(practitioner: WaitingListUser): Promise<IResponse<any>> {
    try {
      const subscription = await this.subscriptionRepo.findSubscription({
        practitionerId: practitioner.id,
      });
      if (!subscription || !subscription?.customerId) throw new Error('Can not find subscription');

      const successfulPaymentIntents = await this.stripeService.getSuccessfulPaymentIntents(subscription.customerId);

      const payments = [];
      for await (const intent of successfulPaymentIntents) {
        const invoice = intent.invoice;
        const charge = invoice?.charge;
        const item = invoice?.lines?.data?.[1] || invoice?.lines?.data?.[0];
        const product = await this.stripeService.getProductPlan(item?.plan.product);
        payments.push({
          amount: intent.amount_received,
          currency: intent.currency,
          date: new Date(intent.created * 1000),
          status: invoice?.status || null,
          periodStartDate: invoice?.period_start ? new Date(item?.period?.start * 1000) : null,
          periodEndDate: invoice?.period_end ? new Date(item?.period?.end * 1000) : null,
          interval: item?.plan?.interval || null,
          planAmount: item?.plan?.amount || null,
          planName: product.name || null,
          planDescription: product?.description || null,
          planQuantity: item?.quantity || null,
          receipt: {
            chargeId: charge?.id || null,
            practitionerName: practitioner.firstName + ' ' + practitioner.lastName || null,
            practitionerEmail: practitioner?.email || null,
            amount: charge?.amount || null,
            datePaid: charge?.created ? new Date(charge.created * 1000) : null,
            paymentMethod: charge?.payment_method_details?.card?.brand ? `${charge.payment_method_details.card.brand} ending ${charge.payment_method_details.card.last4}` : null,
            customerName: charge?.billing_details?.name || null,
            customerEmail: charge?.billing_details?.email || null,
            invoiceId: invoice?.id || null,
          },
        });
      }

      this.triggerEvent(practitioner, 'viewed subscription payment history');
      return this.response.success(payments);
    } catch (error) {
      throw new HttpException(
        {
          message: error.message || 'Error in getting your payment history',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getInvoice(practitioner: WaitingListUser, invoiceId: string): Promise<IResponse<any>> {
    try {
      const subscription = await this.subscriptionRepo.findSubscription({
        practitionerId: practitioner.id,
      });
      const invoice = await this.stripeService.getInvoice(invoiceId, subscription?.customerId);
      if (!invoice) throw new Error('Error in getting your payment invoice');

      return invoice;
    } catch (error) {
      throw new HttpException({ message: error.message || 'Error in getting your payment invoice' }, HttpStatus.BAD_REQUEST);
    }
  }

  private triggerEvent(user: any, description: string, changes?: object) {
    this.eventEmitter.emit('audit.log', {
      actor: { ...user, event: 'Subscription' },
      description,
      resultType: '',
      changes,
    });
  }
}
