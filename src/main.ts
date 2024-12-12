import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { connect as connectToDatabase } from './internal/connect-to-db';
import { coreConfig } from 'config/core';
import { SwaggerConfig } from './internal/swagger.init';
import { ValidationPipe } from '@nestjs/common';
import { SocketIoAdapter } from './helper/socket/adapter';
import { ErrorsInterceptor } from './decorators/controller.decorator';
import { monit } from './internal/db.monitor';

async function bootstrap() {
  await connectToDatabase();
  monit();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.enableCors();
  app.setGlobalPrefix(coreConfig.apiPrefix);
  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    credentials: true,
  });
  app.use(cookieParser());
  coreConfig.env !== 'production' && SwaggerConfig(app);
  // app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ErrorsInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  await app.listen(coreConfig.port);
  console.log(`listing to http://${coreConfig.host}:${coreConfig.port}`);
}
bootstrap();
