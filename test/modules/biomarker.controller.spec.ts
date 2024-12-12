import { INestApplication } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { adminData } from '../test-utility/predefined.data';
import { connectTestDatabase, disConnectTestDatabase, GetTestUserLoginToken } from '../test-utility';
import { BiomarkerModule } from 'src/modules/biomarker/biomarker.module';

describe('Initializing User controller testing', () => {
  let app: INestApplication;

  const { token } = GetTestUserLoginToken(adminData?.id, adminData?.email, adminData?.role);

  beforeAll(async () => {
    await connectTestDatabase();
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, BiomarkerModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }, 10000);

  afterAll(async () => {
    // remove test database collection if required
    await disConnectTestDatabase();
    await app.close();
  });

  it(`should return only one Salivary Cortisol`, async () => {
    return await request(app.getHttpServer())
      .get('/biomarkers?page=1&name=Salivary Cortisol')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        const data = res?.body?.data;
        expect(data).toHaveLength(1);
      });
  });
});
