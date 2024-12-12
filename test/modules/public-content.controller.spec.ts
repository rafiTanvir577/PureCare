import { INestApplication } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { clientData, ownerData } from '../test-utility/predefined.data';
import { connectTestDatabase, disConnectTestDatabase, GetTestUserLoginToken } from '../test-utility';
import { PublicContentModule } from 'src/modules/public-content/public-content.module';
import { Types } from 'mongoose';
import { S3FileUploadService } from 'src/helper/s3Service';

describe('Initializing Public Content controller testing', () => {
  let app: INestApplication;

  const { token } = GetTestUserLoginToken(ownerData?.id, ownerData?.email, ownerData?.role);

  const client = GetTestUserLoginToken(clientData?.id, clientData?.email, clientData?.role);

  const clientToken = client?.token;

  beforeAll(async () => {
    await connectTestDatabase();
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PublicContentModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }, 10000);

  afterAll(async () => {
    // remove test database collection if required
    await disConnectTestDatabase();
    await app.close();
  });

  let contentID: string;
  const expectedData = {
    _id: expect.any(String),
    type: expect.any(String),
    content: {
      title: expect.any(String),
      tag: expect.any(String),
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  };

  const createPublicContent = {
    type: 'SALES',
    content: {
      title: 'Medication',
      tag: 'HEADLINE',
    },
  };

  it(`should return an array of public contents`, async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);

    return await request(app.getHttpServer())
      .get('/public-content')
      .expect((res: { statusCode: any; body: { data: any } }) => {
        expect(res.statusCode).toBe(200);
        const data = res?.body?.data;
        data?.length === 0 ? expect(res.statusCode).toBe(200) : expect(data?.length).not.toBeLessThan(0);
      });
  });

  it(`should create a public content`, async () => {
    return await request(app.getHttpServer())
      .post('/public-content')
      .set('Authorization', `Bearer ${token}`)
      .send(createPublicContent)
      .expect((res) => {
        expect(res.statusCode).toBe(201);
        const data = res?.body?.data;
        expect(data).toEqual(expect.objectContaining(expectedData));
        contentID = data?._id;
      });
  });

  it(`should update a public content`, async () => {
    const updatePublicContent = {
      type: 'SALES',
      content: {
        title: 'EEG offers',
        tag: 'TAG_LINE_1',
      },
    };

    return await request(app.getHttpServer())
      .patch(`/public-content/${new Types.ObjectId(contentID)}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatePublicContent)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        const data = res?.body?.data;
        expect(data).toEqual(expect.objectContaining(expectedData));
      });
  });

  it(`should delete a public content`, async () => {
    return await request(app.getHttpServer())
      .delete(`/public-content/${new Types.ObjectId(contentID)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        const data = res?.body?.data;
        expect(data).toEqual(expect.objectContaining(expectedData));
      });
  });

  //TEST USING CLIENT TOKEN - SHOULD REUSLT IN 401 UNAUTHORIZED ERROR
  it(`should give unauthorized error`, async () => {
    return await request(app.getHttpServer())
      .post('/public-content')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(createPublicContent)
      .expect((res) => expect(res.statusCode).toBe(401));
  });

  it(`should give unauthorized error`, async () => {
    return await request(app.getHttpServer())
      .patch(`/public-content/${new Types.ObjectId(contentID)}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send(createPublicContent)
      .expect((res) => expect(res.statusCode).toBe(401));
  });

  it(`should give unauthorized error`, async () => {
    return await request(app.getHttpServer())
      .delete(`/public-content/${new Types.ObjectId(contentID)}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect((res) => expect(res.statusCode).toBe(401));
  });
});
