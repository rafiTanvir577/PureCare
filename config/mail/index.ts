const { SENDGRID_API_KEY } = process.env;

export const sendgridConfig = {
  apiKey: SENDGRID_API_KEY! || 'SG.',
};
