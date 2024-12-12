import { Injectable, NestMiddleware } from '@nestjs/common';
import { loggerConfig } from 'config/logger';
import * as winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { Role, User } from 'src/entity';
import { coreConfig } from 'config/core';
import { UserModel } from 'src/modules/user/repository/user.model';
import { getLogger } from 'src/helper/logger/init';
import { sanitizeRequestBodyWithXss } from 'src/helper/inputSanitize';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger: winston.Logger;

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, params, query } = req;
    const user = (req as unknown as { user: User }).user;
    const owner = user?.id && UserModel.findOne({ id: user.id, role: Role.OWNER });

    // Set up the logger if conditions are met (production environment, valid logger configuration)
    this.logger = coreConfig.env === 'production' && loggerConfig.host && getLogger();

    // Sanitize request body
    req.body = sanitizeRequestBodyWithXss(req.body);

    next(); // Continue to the next middleware and route

    // Log the request only if it resulted in a successful response (status code in the 2xx range)
    if (user && !owner && this.logger && res.statusCode >= 200 && res.statusCode < 300) {
      // Create a log entry with request details
      const logEntry: winston.LogEntry = {
        level: 'info',
        message: 'Request Log',
        app: loggerConfig.app_name,
        method,
        originalUrl,
        params,
        query,
        userId: user.id,
        role: user.role,
      };

      // Log the entry using the configured logger
      this.logger.log(logEntry);
    }
  }
}
