import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import base64url from 'base64url';
import { AppModule } from 'src/app.module';
import { GetTestUserLoginToken, adminData, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { DataEntryUserStatus, Role } from 'src/entity';
import { UserModel } from 'src/modules/user/repository/user.model';
import { WaitingListHelper } from 'src/modules/waiting-list/waiting-list.helper';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
const mockDataEntryUserData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'dataentry@pc.com',
  role: Role.DATA_OPERATOR,
};

describe('Initializing DataEntryUser Controller Testing', () => {
  let app: INestApplication;
  let adminAuthToken: string;
  let dataEntryUserId: string;
  let setPasswordToken: string;

  beforeAll(async () => {
    await connectTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    const { token: adminToken } = GetTestUserLoginToken(adminData?.id, adminData?.email, adminData?.role);
    adminAuthToken = adminToken;

    await app.init();
  }, 10000);

  afterAll(async () => {
    try {
      // Cleanup and disconnect from the test database
      await UserModel.deleteOne({
        email: mockDataEntryUserData.email,
      });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('POST /data-entry-user/add should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).post('/data-entry-user/add').send(mockDataEntryUserData).expect(401);
  });

  it('POST /data-entry-user/add should return 400 Bad Request if the request data is invalid', async () => {
    await request(app.getHttpServer())
      .post(`/data-entry-user/add`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({
        ...mockDataEntryUserData,
        email: 'invalid email',
      })
      .expect(400);
  });

  it('POST /data-entry-user/add should add a data entry user', async () => {
    // Mock implementation of the send email function
    jest.spyOn(WaitingListHelper.prototype, 'sendEmail').mockReturnValue({});

    const response = await request(app.getHttpServer()).post(`/data-entry-user/add`).set('Authorization', `Bearer ${adminAuthToken}`).send(mockDataEntryUserData).expect(201);

    expect(response.body).toBeDefined();

    try {
      const user = response.body?.data;
      dataEntryUserId = user?.id;
      // Generate setPasswordTokenParams using bas64 encoded
      const queryParams = `email=${user.email}&token=${user.setPasswordToken}`;
      setPasswordToken = base64url(Buffer.from(queryParams));
    } catch (error) {}
  });

  it(`POST /data-entry-user/add should Should return 400 Bad Request if email already exists`, async () => {
    await request(app.getHttpServer()).post(`/data-entry-user/add`).set('Authorization', `Bearer ${adminAuthToken}`).send(mockDataEntryUserData).expect(400);
  });

  it('PATCH /data-entry-user/set-password/:token should set a new password', async () => {
    const newPasswordData = {
      password: 'String000001@',
    };

    const response = await request(app.getHttpServer()).patch(`/data-entry-user/set-password/${setPasswordToken}`).send(newPasswordData).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /data-entry-user/all should return a list of data entry users', async () => {
    const response = await request(app.getHttpServer()).get(`/data-entry-user/all?status=${DataEntryUserStatus.ACTIVE}`).set('Authorization', `Bearer ${adminAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /data-entry-user/:id should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get(`/data-entry-user/${dataEntryUserId}`).expect(401);
  });

  it('GET /data-entry-user/:id should return 400 Bad Request if the user does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/data-entry-user/${dataEntryUserId + '1'}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(400);
  });

  it('GET /data-entry-user/:id should return a data entry user by ID', async () => {
    const response = await request(app.getHttpServer()).get(`/data-entry-user/${dataEntryUserId}`).set('Authorization', `Bearer ${adminAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /data-entry-user/:id/update should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/data-entry-user/${dataEntryUserId}/update`)
      .send({
        firstName: mockDataEntryUserData.firstName,
      })
      .expect(401);
  });

  it('PATCH /data-entry-user/:id/update should update a data entry user profile by ID', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/data-entry-user/${dataEntryUserId}/update`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({
        firstName: mockDataEntryUserData.firstName,
      })
      .expect(200);

    expect(response.body).toBeDefined();
  });

  it('POST /data-entry-user/:id/send-change-password-email should send a change password email', async () => {
    const response = await request(app.getHttpServer()).post(`/data-entry-user/${dataEntryUserId}/send-change-password-email`).set('Authorization', `Bearer ${adminAuthToken}`).expect(201);

    expect(response.body).toBeDefined();
    try {
      const user = await UserModel.findOne({
        email: mockDataEntryUserData?.email,
      });
      // Generate setPasswordTokenParams using bas64 encoded
      const queryParams = `email=${user.email}&token=${user.setPasswordToken}`;
      setPasswordToken = base64url(Buffer.from(queryParams));
    } catch (error) {}
  });

  it('PATCH /data-entry-user/set-password/:token should change the old password', async () => {
    const newPasswordData = {
      password: 'String0000@',
    };

    const response = await request(app.getHttpServer()).patch(`/data-entry-user/set-password/${setPasswordToken}`).set('Authorization', `Bearer ${adminAuthToken}`).send(newPasswordData).expect(200);

    expect(response.body).toBeDefined();
  });

  // it('POST /data-entry-user/:id/revoke-session should revoke user sessions', async () => {
  //   const response = await request(app.getHttpServer())
  //     .post(`/data-entry-user/${dataEntryUserId}/revoke-session`)
  //     .set('Authorization', `Bearer ${adminAuthToken}`)
  //     .expect(201);

  //   expect(response.body).toBeDefined();
  // });
});
