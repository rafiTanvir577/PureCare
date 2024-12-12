import { loggerConfig } from 'config/logger';
import * as winston from 'winston';
import LokiTransport = require('winston-loki');
const { createLogger, format, transports } = winston;
let logger: winston.Logger;

const initializeLogger = () => {
  if (logger) {
    return logger;
  }

  try {
    return createLogger({
      transports: [
        new LokiTransport({
          host: loggerConfig.host,
          labels: { app: loggerConfig.app_name },
          basicAuth: `${loggerConfig.userId}:${loggerConfig.password}`,
          json: true,
          format: format.json(),
          replaceTimestamp: true,
          onConnectionError: (err) => console.error(err),
        }),
      ],
      exceptionHandlers: [
        new transports.Console({
          format: format.combine(format.simple(), format.colorize()),
        }),
      ],
      handleExceptions: true,
    });
  } catch (error) {
    return null;
  }
};

export const getLogger = () => {
  return !logger ? initializeLogger() : logger;
};
