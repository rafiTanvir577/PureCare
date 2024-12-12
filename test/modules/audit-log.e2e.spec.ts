import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { GetTestUserLoginToken, adminData, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { Role } from 'src/entity';
import { WaitingListModel } from 'src/modules/waiting-list/repository/waiting-list.model';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
import { WaitingListUserQualificationStatus } from 'src/entity/waiting-list.entity';
const mockRegistrationData = {
  license: 'Team',
  firstName: 'Yadav',
  lastName: 'Panday',
  email: 'audit-log-user@example.com',
  country: 'United States',
  countryCode: '+44',
  phone: '1234567890',
  referralSource: 'Event',
  sessionIds: ['1234567890'],
  isEmailVerified: true,
  qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
};

describe('Initializing Practitioner controller Testing', () => {
  let app: INestApplication;
  let practitionerToken: string;
  const { token: ownerToken } = GetTestUserLoginToken(adminData?.id, adminData?.email, adminData?.role);

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
      practitionerToken = token;
      await AuditLogModel.insertMany([
        {
          actor: {
            id: practitioner.id,
            name: practitioner.firstName + ' ' + practitioner.lastName,
            role: practitioner.role || Role.PRACTITIONER,
          },
          req: {
            ip: '::ffff:127.0.0.1',
            device: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            url: '/api/biomarkers/summary?page=1&type=smpdb-components',
            method: 'GET',
          },
          result: 'viewed biomarkers summary',
          event: 'Biomarker',
          resultType: 'positive',
          secondFactor: null,
          createdAt: {
            $date: '2024-01-09T13:30:16.321Z',
          },
        },
      ]);
    } catch (error) {}

    await app.init();
  }, 20000);

  afterAll(async () => {
    try {
      await WaitingListModel.deleteOne({ email: mockRegistrationData?.email }); // Delete mock data to avoid duplicacy error
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('GET /audit-logs/owner should return owner audit logs', async () => {
    const response = await request(app.getHttpServer()).get('/audit-logs/owner').set('Authorization', `Bearer ${ownerToken}`).query({}).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /audit-logs/owner should return an authenticate error if the practitioner is required to show the owner audit logs.', async () => {
    await request(app.getHttpServer()).get('/audit-logs/owner').set('Authorization', `Bearer ${practitionerToken}`).query({}).expect(401);
  });

  it('GET /audit-logs/owner should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get('/audit-logs/owner').expect(401);
  });

  it('GET /audit-logs/practitioner should return practitioner audit logs', async () => {
    const response = await request(app.getHttpServer()).get('/audit-logs/practitioner').set('Authorization', `Bearer ${practitionerToken}`).query({}).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /audit-logs/practitioner should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get('/audit-logs/practitioner').expect(401);
  });
});
