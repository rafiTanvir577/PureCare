import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { GetTestUserLoginToken, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { Role } from 'src/entity';
import { ClientErrorMessages } from 'src/entity/client.entity';
import { WaitingListModel } from 'src/modules/waiting-list/repository/waiting-list.model';
import { ClientModel } from 'src/modules/practitioner/repository/client.model';
import { S3FileUploadService } from 'src/helper/s3Service';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
import { WaitingListUserQualificationStatus } from 'src/entity/waiting-list.entity';
const mockRegistrationData = {
  license: 'Team',
  firstName: 'Yadav',
  lastName: 'Panday',
  email: 'practitioner@example.com',
  country: 'United States',
  countryCode: '+44',
  phone: '1234567890',
  referralSource: 'Event',
  sessionIds: ['1234567890'],
  isEmailVerified: true,
  qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
};

const mockClientData = {
  firstName: 'Yadav',
  lastName: 'Panday',
  email: 'client@example.com',
  dateOfBirth: '2023-10-03T06:17:22.263+00:00',
};

describe('Initializing Practitioner controller Testing', () => {
  let app: INestApplication;
  let authToken: string;
  let clientId: string;
  let reportId: string;

  beforeAll(async () => {
    await connectTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    try {
      // insert data before testing & generate the authToken
      let practitioner: any = await WaitingListModel.findOne({
        email: mockRegistrationData?.email,
      });
      practitioner = practitioner || (await WaitingListModel.create(mockRegistrationData));
      const { token } = GetTestUserLoginToken(practitioner.id, practitioner.email, Role.PRACTITIONER, '1234567890');
      authToken = token;
    } catch (error) {}

    await app.init();
  }, 20000);

  afterAll(async () => {
    try {
      await WaitingListModel.deleteOne({ email: mockRegistrationData?.email }); // Delete mock data to avoid duplicacy error
      await ClientModel.deleteOne({ email: mockClientData?.email });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('POST /practitioner/add-client should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).post('/practitioner/add-client').send(mockClientData).expect(401);
  });

  it('POST /practitioner/add-client should return 400 Bad Request if required data is missing', async () => {
    const mockClientDataWithoutSomeFields = {
      ...mockClientData,
      firstName: '',
    };
    await request(app.getHttpServer()).post('/practitioner/add-client').set('Authorization', `Bearer ${authToken}`).send(mockClientDataWithoutSomeFields).expect(400);
  });

  it('POST /practitioner/add-client should add a new client', async () => {
    const response = await request(app.getHttpServer()).post('/practitioner/add-client').set('Authorization', `Bearer ${authToken}`).send(mockClientData).expect(201);

    expect(response.body).toBeDefined();
    const client = response.body?.data;
    clientId = client?.id;
  });

  it('PATCH /practitioner/upload-lab-reports/:clientId should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer())
      .post(`/practitioner/upload-lab-reports/${clientId}`)
      .send({
        files: ['sample.pdf'],
      })
      .expect(401);
  });

  it('POST /practitioner/upload-lab-reports/:clientId should upload lab reports for a client', async () => {
    const response = await request(app.getHttpServer())
      .post(`/practitioner/upload-lab-reports/${clientId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        files: ['sample.pdf'],
      })
      .expect(201);

    expect(response.body).toBeDefined();
    const reports = response.body?.data;
    reportId = reports[0]?.id;
  });

  it('PATCH /practitioner/update-lab-reports/:reportId should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).patch(`/practitioner/update-lab-reports/${reportId}`).send({}).expect(401);
  });

  it('GET /practitioner/clients should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get('/practitioner/clients').expect(401);
  });

  it('GET /practitioner/clients should get all clients for the practitioner', async () => {
    const response = await request(app.getHttpServer())
      .get('/practitioner/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        limit: 10,
      })
      .expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /practitioner/clients/:clientId should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get(`/practitioner/clients/${clientId}`).expect(401);
  });

  it('GET /practitioner/clients/:clientId should return 400 Bad Request if the client ID does not exist or Invalid', async () => {
    const response = await request(app.getHttpServer())
      .get(`/practitioner/clients/${clientId + '3'}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(response.body.message).toBe(ClientErrorMessages.CAN_NOT_GET_CLIENT);
  });

  it('GET /practitioner/clients/:clientId should get a specific client with their lab reports', async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);

    const response = await request(app.getHttpServer()).get(`/practitioner/clients/${clientId}`).set('Authorization', `Bearer ${authToken}`).expect(200);

    expect(response.body).toBeDefined();
  });
});
