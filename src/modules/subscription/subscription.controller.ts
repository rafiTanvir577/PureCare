import { Body, Controller, Get, Param, Patch, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { SubscriptionService } from './subscription.service';
import { User as UserInfo } from 'src/decorators/auth.decorator';
import { StripeService } from './stripe.service';
import { WaitingListUser } from 'src/entity/waiting-list.entity';
import { CreateSubscriptionSessionDto } from './dto/subscription.dto';
import { PermissionRequired } from 'src/decorators/permission.decorator';
import { PERMISSIONS } from 'src/entity/permissions.enum';
import { RolesGuard } from 'src/guards/roles.guard';

@ApiTags('Subscription Controller')
@Controller('subscription')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService, private stripeService: StripeService) {}

  @Get('products')
  @ApiBearerAuth()
  @PermissionRequired(PERMISSIONS.VIEW_STRIPE_PRODUCTS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getProducts() {
    return await this.stripeService.getAllActiveProducts();
  }

  @Get('prices/:productId')
  @PermissionRequired(PERMISSIONS.VIEW_STRIPE_PRODUCTS)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getAllRecurringPrices(@Param('productId') productId: string) {
    return await this.stripeService.getAllRecurringPrices(productId);
  }

  @Post('create-subscription-session')
  @PermissionRequired(PERMISSIONS.CREATE_CHECKOUT_SESSION)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createStripeRecurringSession(@Body() body: CreateSubscriptionSessionDto, @UserInfo() practitioner: WaitingListUser) {
    return await this.subscriptionService.createStripeRecurringSession(practitioner, body.priceId, body.quantity);
  }

  @Patch('cancel-subscription')
  @PermissionRequired(PERMISSIONS.CANCEL_SUBSCRIPTION)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async cancelSubscription(@UserInfo() practitioner: WaitingListUser) {
    return await this.subscriptionService.cancelSubscription(practitioner);
  }

  // @Patch('update-subscription')
  // @PermissionRequired(PERMISSIONS.UPDATE_SUBSCRIPTION)
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // async updateSubscription(
  //   @Body() body: CreateSubscriptionSessionDto,
  //   @UserInfo() practitioner: WaitingListUser,
  // ) {
  //   return await this.subscriptionService.updateSubscription(
  //     practitioner,
  //     body,
  //   );
  // }

  @Get('payment-history')
  @PermissionRequired(PERMISSIONS.VIEW_PAYMENT_HISTORY)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPaymentHistory(@UserInfo() practitioner: WaitingListUser) {
    return await this.subscriptionService.getPaymentHistory(practitioner);
  }

  @Get('payment-history/:invoiceId')
  @PermissionRequired(PERMISSIONS.VIEW_PAYMENT_HISTORY)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getInvoice(@UserInfo() practitioner: WaitingListUser, @Param('invoiceId') invoiceId: string) {
    return await this.subscriptionService.getInvoice(practitioner, invoiceId);
  }

  @Get('subscription-billing-info')
  @ApiBearerAuth()
  @PermissionRequired(PERMISSIONS.VIEW_BILLING_INFO)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getBillingInfo(@UserInfo() practitioner: WaitingListUser) {
    return await this.subscriptionService.getBillingInfo(practitioner);
  }

  @Post('webhook')
  async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'];
    return await this.stripeService.handleWebhook(req.rawBody, signature);
  }
}
