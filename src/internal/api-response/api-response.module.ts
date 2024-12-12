import { Global, Module } from '@nestjs/common';

import { APIResponse } from './api-response.service';

@Global()
@Module({
  providers: [APIResponse],
  exports: [APIResponse],
})
export class APIResponseModule {}
