import { Request } from 'express';

export const getIpAddress = (req: Request): string => {
  let forwardedFor = req.headers['x-forwarded-for'] as string;
  forwardedFor = forwardedFor?.split(',')?.[0];
  const remoteAddress = req.connection.remoteAddress;
  const realIp = req.headers['x-real-ip'];
  return (forwardedFor || realIp || remoteAddress || req.ip) as string;
};
