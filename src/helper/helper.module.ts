import { Global, Module } from '@nestjs/common';
import { SendGridService } from './sendgrid';

@Global()
@Module({
  providers: [SendGridService],
  exports: [SendGridService],
})
export class HelperModule {}
