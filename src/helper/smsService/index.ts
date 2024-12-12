import { Global, Injectable } from '@nestjs/common';
import { twilioSmsConfig } from 'config/twilio';
import * as twilio from 'twilio';

@Global()
@Injectable()
export class SMSService {
  async sendSMS(phone: string, body: string): Promise<void> {
    try {
      const twilioClient = twilio(twilioSmsConfig.accountSid, twilioSmsConfig.authToken, {
        autoRetry: true,
      });
      // Send SMS
      await twilioClient.messages.create({
        body,
        to: phone,
        from: twilioSmsConfig.authPhone,
      });
    } catch (err) {
      console.log(err);
    }
  }
}
