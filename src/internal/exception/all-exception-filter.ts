import { Catch, ArgumentsHost, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { coreConfig } from 'config/core';
import { loggerConfig } from 'config/logger';
import { Response, Request } from 'express';
import { AuditLogResultType } from 'src/entity/audit.entity';
import { addAuditLog } from 'src/events/database';
import { getLogger } from 'src/helper/logger/init';
import { getIpAddress } from 'src/helper/utils/ip';
import * as winston from 'winston';

export interface IException {
  response: Record<string, any>;
  status: number;
  statusCode: number;
  name: string;
  message: string;
  stack: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly className: string) {}

  catch(exception: IException, host: ArgumentsHost): any {
    const ctx = host.switchToHttp();
    const res: Response = ctx.getResponse<Response>();
    const req: Request = ctx.getRequest<Request>();
    const { method, originalUrl } = req;
    const origin = req.get('origin') || '';
    const errorObj = exception?.response || { message: 'Something went wrong' };
    const logger: winston.Logger = coreConfig.env === 'production' && loggerConfig.host && getLogger();

    // logger
    if (logger) {
      logger.error({
        app: loggerConfig.app_name,
        method,
        origin,
        originalUrl,
        status: exception?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        errors: errorObj.message,
        errorName: exception?.name,
        message: exception?.message,
        stack: exception?.stack,
      });
    } else {
      console.error(exception);
    }
    this.triggerEvent(req, errorObj.message, this.className);
    res.status(exception?.status || HttpStatus.INTERNAL_SERVER_ERROR).json(errorObj);
  }

  private async triggerEvent(req: Request, error: string, className: string) {
    const { originalUrl, headers, method } = req;
    let event = className;
    if (className && className?.endsWith('Controller')) {
      // Remove "Controller" from the end of className
      event = className?.slice(0, -'Controller'.length);
    }
    const data = {
      actor: {
        name: 'Unknown Error:',
      },
      req: {
        ip: getIpAddress(req),
        url: originalUrl,
        device: headers['user-agent'],
        method,
      },
      event,
      result: JSON.stringify(error),
      resultType: AuditLogResultType.NEGATIVE,
      changes: {},
    };
    await addAuditLog(data);
  }
}
