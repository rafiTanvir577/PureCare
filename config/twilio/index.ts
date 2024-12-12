const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_AUTH_PHONE } =
  process.env;

export const twilioSmsConfig = {
  accountSid: TWILIO_ACCOUNT_SID || '',
  authToken: TWILIO_AUTH_TOKEN || '',
  authPhone: TWILIO_AUTH_PHONE || '',
};
