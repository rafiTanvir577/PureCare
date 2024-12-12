import { INestApplication } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { clientData, ownerData } from '../test-utility/predefined.data';
import { connectTestDatabase, disConnectTestDatabase, GetTestUserLoginToken } from '../test-utility';
import { PublicContentModule } from 'src/modules/public-content/public-content.module';
import { Types } from 'mongoose';
import { S3FileUploadService } from 'src/helper/s3Service';

describe('Initializing Testimonial testing', () => {
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

  let testimonialID;
  const expectedData = {
    _id: expect.any(String),
    type: expect.any(String),
    content: {
      title: expect.any(String),
      image: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
      text: expect.any(String),
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  };

  const createTestimonial = {
    type: 'TESTIMONIAL',
    content: {
      firstName: 'Monica',
      lastName: 'Ali',
      title: 'Functional Medicine Practitioner',
      text: 'Functional Medicine urgently needs this!',
      image: 'assets/testimonial/monica.jpg',
    },
  };

  it(`should create a testimonial`, async () => {
    return await request(app.getHttpServer())
      .post('/public-content')
      .set('Authorization', `Bearer ${token}`)
      .send(createTestimonial)
      .expect((res) => {
        expect(res.statusCode).toBe(201);
        const data = res?.body?.data;
        expect(data).toEqual(expect.objectContaining(expectedData));
        testimonialID = data?._id;
      });
  });

  it(`should return an array of testimonials`, async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);

    return await request(app.getHttpServer())
      .get('/public-content')
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        const data = res?.body?.data;
        data?.length === 0 ? expect(res.statusCode).toBe(200) : expect(data).toEqual(expect.arrayContaining([expectedData]));
      });
  });

  it(`should update a public content`, async () => {
    const updatePublicContent = {
      type: 'TESTIMONIAL',
      content: {
        title: 'Professor of Systems Biology',
        firstName: 'Healthcare practitioners need tools that harness deep data sources.',
      },
    };

    return await request(app.getHttpServer())
      .patch(`/public-content/${new Types.ObjectId(testimonialID)}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatePublicContent)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        const data = res?.body?.data;
        expect(data).toEqual(expect.objectContaining(expectedData));
      });
  });

  it(`should delete a testimonial`, async () => {
    return await request(app.getHttpServer())
      .delete(`/public-content/${new Types.ObjectId(testimonialID)}`)
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
      .send(createTestimonial)
      .expect((res) => expect(res.statusCode).toBe(401));
  });

  it(`should give unauthorized error`, async () => {
    return await request(app.getHttpServer())
      .patch(`/public-content/${new Types.ObjectId(testimonialID)}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send(createTestimonial)
      .expect((res) => expect(res.statusCode).toBe(401));
  });

  it(`should give unauthorized error`, async () => {
    return await request(app.getHttpServer())
      .delete(`/public-content/${new Types.ObjectId(testimonialID)}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect((res) => expect(res.statusCode).toBe(401));
  });
});
