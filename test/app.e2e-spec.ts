import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import * as request from 'supertest';
import { connectTestDatabase, disConnectTestDatabase } from './test-utility';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await connectTestDatabase();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  }, 10000);

  afterAll(async () => {
    await disConnectTestDatabase();
    await app.close();
  });

  it('Root path / api should throw 404 error', () => {
    return request(app.getHttpServer()).get('/').expect(404).expect('{"statusCode":404,"message":"Cannot GET /","error":"Not Found"}');
  });
});
