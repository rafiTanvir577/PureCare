import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { stripeConfig } from 'config/stripe';
import { SubscriptionRepository } from './repository/subscription.repository';
import { SubscriptionStatus } from 'src/entity/subscription.entity';
type Mode = 'payment' | 'setup' | 'subscription';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  constructor(private subscriptionRepo: SubscriptionRepository) {
    this.stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  async getAllActiveProducts(): Promise<any> {
    try {
      return await this.stripe.products.list({
        active: true,
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getAllRecurringPrices(productId: string): Promise<any> {
    try {
      // Retrieve monthly prices associated with the product
      const monthlyPrices = await this.stripe.prices.list({
        product: productId,
        recurring: { interval: 'month' },
      });

      // Retrieve yearly prices associated with the product
      const yearlyPrices = await this.stripe.prices.list({
        product: productId,
        recurring: { interval: 'year' },
      });

      return { monthlyPrices, yearlyPrices };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async createCheckoutSession(priceId: string, quantity: number, practitionerId: string): Promise<any> {
    try {
      const [subscription, practitioner] = await Promise.all([
        await this.subscriptionRepo.findSubscription({
          practitionerId,
        }),
        await this.subscriptionRepo.findPractitionerInfo({
          id: practitionerId,
        }),
      ]);
      return await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: quantity || 1 }],
        mode: 'subscription' as Mode,
        success_url: stripeConfig.successUrl,
        cancel_url: stripeConfig.cancelUrl,
        ...(subscription?.customerId && { customer: subscription.customerId }),
        ...(!subscription?.customerId && practitioner?.email && { customer_email: practitioner.email }),
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, newPriceId: string, quantity: number): Promise<any> {
    try {
      // Retrieve the current subscription
      const currentSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      // Update the subscription with the new price and quantity
      return await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: currentSubscription.items.data[0].id,
            price: newPriceId,
            quantity: quantity || 1,
          },
        ],
        // This behavior doesn't create any prorations. The subscription is updated immediately, and no adjustments are made for the current billing cycle.
        // The customer is charged the full amount for the new plan at the start of the next billing cycle.
        proration_behavior: 'none',
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<any> {
    try {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getSubscriptionInfo(subscriptionId: string): Promise<any> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getProductPlan(productId: string): Promise<any> {
    try {
      return await this.stripe.products.retrieve(productId);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async handleWebhook(payload: any, signature: string | string[]) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, stripeConfig.wHSecretKey);
    } catch (error) {
      console.error(`Stripe Webhook error: ${error.message}`);
      throw new HttpException({ message: 'Error in verifying stripe subscription' }, HttpStatus.BAD_REQUEST);
    }
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const checkoutSessionCompleted = event.data.object;
        const checkPractitioner = await this.subscriptionRepo.findSubscription({
          sessionId: checkoutSessionCompleted.id,
        });
        if (checkPractitioner && checkoutSessionCompleted.payment_status === 'paid') {
          const [invoiceInfo, subscriptionInfo] = await Promise.all([await this.stripe.invoices.retrieve(checkoutSessionCompleted.invoice as string), await this.getSubscriptionInfo(checkoutSessionCompleted.subscription as string)]);
          // Retrieve the Payment Intent to get payment method details
          const paymentIntent = await this.stripe.paymentIntents.retrieve(invoiceInfo.payment_intent as string);

          // Retrieve the Payment Method to get card details
          const paymentMethodId = paymentIntent.payment_method;
          const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId as string);

          const generateQuery: any = {
            sessionId: checkoutSessionCompleted.id,
          };
          if (checkPractitioner?.practitionerId) {
            generateQuery.practitionerId = checkPractitioner.practitionerId;
          }
          this.subscriptionRepo.updateSubscription(generateQuery, {
            cardLast4: paymentMethod.card.last4,
            cardExpMonth: paymentMethod.card.exp_month,
            cardExpYear: paymentMethod.card.exp_year,
            customerId: (checkoutSessionCompleted.customer || checkPractitioner?.customerId) as string,
            subscriptionId: checkoutSessionCompleted.subscription as string,
            expireTime: new Date(subscriptionInfo.current_period_end * 1000),
            status: SubscriptionStatus.ACTIVE,
            cardBrand: paymentMethod.card.brand,
            productId: subscriptionInfo?.plan?.product,
            amount: subscriptionInfo?.plan?.amount,
            interval: subscriptionInfo?.plan?.interval,
            sessionId: null,
          });
        }
        break;
      case 'invoice.payment_succeeded':
        const invoicePaymentSucceeded = event.data.object;

        // Check if the payment is for a subscription
        if (invoicePaymentSucceeded.billing_reason === 'subscription_cycle') {
          const subscriptionId = invoicePaymentSucceeded.subscription;

          // Retrieve the subscription to get details
          const subscription = await this.stripe.subscriptions.retrieve(subscriptionId as string);

          // Update the subscription expire time
          this.subscriptionRepo.updateSubscription(
            {
              subscriptionId: subscriptionId,
            },
            {
              expireTime: new Date(subscription.current_period_end * 1000),
            },
          );
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  }

  async getSuccessfulPaymentIntents(customerId: string): Promise<any[]> {
    try {
      const paymentIntents = await this.stripe.paymentIntents.list({
        customer: customerId,
        expand: ['data.invoice', 'data.invoice.charge'],
      });

      const successfulPaymentIntents = paymentIntents.data.filter((intent) => intent.status === 'succeeded' && (intent.invoice as any)?.status === 'paid');

      return successfulPaymentIntents || [];
    } catch (error) {
      console.error('Error in getSuccessfulPaymentIntents:', error);
      throw new Error('Failed to fetch successful payment intents');
    }
  }

  async getInvoice(invoiceId: string, customerId: string): Promise<any> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
      });

      // Find the specific invoice in the list
      const invoice = invoices.data.find((inv) => inv.id === invoiceId);
      return invoice ? invoice : null;
    } catch (error) {
      console.error('Error retrieving invoices:', error);
      throw error;
    }
  }
}
