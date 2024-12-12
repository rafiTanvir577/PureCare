import { HttpException, HttpStatus } from '@nestjs/common';

export class SubscriptionException extends HttpException {
  constructor(message: string) {
    super(message, 419);
  }
}
