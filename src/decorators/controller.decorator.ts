import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AllExceptionsFilter } from 'src/internal/exception/all-exception-filter';

@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const className = context.getClass().name || 'UnknownController';
    return next.handle().pipe(
      catchError((err) => {
        // Throw the AllExceptionsFilter to override the default exception filter
        return throwError(() => new AllExceptionsFilter(className).catch(err, context));
      }),
    );
  }
}
