import { HelperModule } from './helper/helper.module';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { APIResponseModule } from './internal/api-response/api-response.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { RequestLoggerMiddleware } from './middlewares/request-logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [HelperModule, AuthModule, UserModule, APIResponseModule, SubscriptionModule, EventEmitterModule.forRoot(), ScheduleModule.forRoot()],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply RequestLoggerMiddleware for specific methods
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.POST }, { path: '*', method: RequestMethod.PATCH }, { path: '*', method: RequestMethod.PUT }, { path: '*', method: RequestMethod.DELETE });
  }
}
