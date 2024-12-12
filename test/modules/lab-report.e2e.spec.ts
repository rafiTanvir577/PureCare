import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import * as bcrypt from 'bcrypt';
import { GetTestUserLoginToken, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { Role, User } from 'src/entity';
import { S3FileUploadService } from 'src/helper/s3Service';
import { LabReportStatus } from 'src/entity/lab-report.entity';
import { LabReportModel } from 'src/modules/lab-report/repository/lab-report.model';
import { authConfig } from 'config/auth';
import { UserModel } from 'src/modules/user/repository/user.model';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
const chars = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const labReportUniqueId = async () => {
  let result = '';
  const buffer = crypto.randomBytes(8);

  for (let i = 0; i < 8; i++) {
    const index = buffer[i] % chars.length;
    result += chars[index];
  }
  if (await LabReportModel.findOne({ id: result })) {
    result = await labReportUniqueId();
  }
  return result;
};
const mockSupervisorData = {
  firstName: 'Priya',
  lastName: 'Parvin',
  email: 'supervisor4@pc.com',
  role: Role.DATA_SUPERVISOR,
  password: 'String000000@',
  isEmailVerified: true,
  sessionId: '12345678',
};
const mockOperatorData = {
  firstName: 'Priya',
  lastName: 'Parvin',
  email: 'operator@pc.com',
  role: Role.DATA_OPERATOR,
  password: 'String000000@',
  isEmailVerified: true,
  sessionId: '12345678',
};
const mockRedactedLabReports = [
  {
    file: 'sample1.pdf',
    clientId: '1',
    practitionerId: '1',
    uploadedDate: '2023-10-03T06:50:36.149Z',
    status: 'REDACTED',
  },
  {
    file: 'sample2.pdf',
    clientId: '2',
    practitionerId: '2',
    uploadedDate: '2023-10-01T06:50:36.149Z',
    status: 'NON-REDACTED',
  },
];
const mockDataEntryData = {
  laboratory: {
    id: '64d1dfdbd5121f442c1b10f4',
    name: 'Lab-corp',
  },
  biomarkers: [
    {
      id: '64f03ab1dffa1a20f2c9f534',
      name: 'Protein [Mass/volume] in Serum or Plasma',
      uofm: 'g/dL',
      value: 12,
      interpretation: 'High',
    },
  ],
};
const mockReferLabReport = {
  lab_details: 'Missing',
  biomarker: {
    name: 'Missing',
    units: 'Missing',
    interpretation: 'Incorrect',
  },
};

describe('Initializing Lab Report Controller Testing', () => {
  let app: INestApplication;
  let operatorAuthToken: string;
  let supervisorAuthToken: string;
  let operator: User;
  let supervisor: User;
  let operatorLabReportId: string;
  let supervisorLabReportId: string;
  const mockRedactedLabReportIds: string[] = [];

  beforeAll(async () => {
    await connectTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    // insert data before testing
    try {
      const password = await bcrypt.hash(mockSupervisorData.password, authConfig.salt);
      supervisor = await UserModel.create({
        ...mockSupervisorData,
        password,
      });
      operator = await UserModel.create({
        ...mockOperatorData,
        password,
      });

      const { token: supervisorToken } = GetTestUserLoginToken(supervisor.id, supervisor.email, Role.DATA_SUPERVISOR, supervisor.sessionId);
      supervisorAuthToken = supervisorToken;

      const { token: operatorToken } = GetTestUserLoginToken(operator.id, operator.email, Role.DATA_OPERATOR, supervisor.sessionId);
      operatorAuthToken = operatorToken;
    } catch (error) {}

    try {
      await LabReportModel.insertMany(
        await Promise.all(
          mockRedactedLabReports.map(async (mockRedactedLabReport) => {
            const mockRedactedLabReportId = await labReportUniqueId();
            mockRedactedLabReportIds.push(mockRedactedLabReportId);
            return {
              ...mockRedactedLabReport,
              id: mockRedactedLabReportId,
            };
          }),
        ),
      );
    } catch (error) {
      console.log(error);
    }

    await app.init();
  }, 10000);

  afterAll(async () => {
    try {
      await LabReportModel.deleteMany({
        id: { $in: mockRedactedLabReportIds },
      });
      await UserModel.deleteMany({
        id: { $in: [operator.id, supervisor.id] },
      });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('GET /supervisor-lab-reports should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get('/supervisor-lab-reports').expect(401);
  });

  it('GET /supervisor-lab-reports should return lab reports for supervisor', async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);

    const response = await request(app.getHttpServer()).get(`/supervisor-lab-reports?status=${LabReportStatus.NON_REDACTED}`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
    const labReports = response.body?.data;
    supervisorLabReportId = labReports[0]?.id;
  });

  it('POST /lab-reports/:id/redact should redact a lab report', async () => {
    const response = await request(app.getHttpServer()).post(`/lab-reports/${supervisorLabReportId}/redact`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(201);

    expect(response.body).toBeDefined();
  });

  it('GET /operator-lab-reports should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get('/operator-lab-reports').expect(401);
  });

  it('GET /operator-lab-reports should return lab reports for operator', async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);
    const response = await request(app.getHttpServer()).get('/operator-lab-reports').set('Authorization', `Bearer ${operatorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
    const labReports = response.body?.data;
    operatorLabReportId = labReports[0]?.id;
  });

  it('GET /supervisor-lab-reports/:id should return a specific lab report for supervisor', async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);

    const response = await request(app.getHttpServer()).get(`/supervisor-lab-reports/${supervisorLabReportId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /operator-lab-reports/:id should return a specific lab report for operator', async () => {
    // Mock implementation of the S3 generatePreSignedUrl function
    jest.spyOn(S3FileUploadService.prototype, 'generatePreSignedUrl').mockReturnValue('' as any);

    const response = await request(app.getHttpServer()).get(`/operator-lab-reports/${operatorLabReportId}`).set('Authorization', `Bearer ${operatorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /lab-reports/:id/persist-laboratory should persist laboratory data for a lab report by operator', async () => {
    const response = await request(app.getHttpServer()).patch(`/lab-reports/${operatorLabReportId}/persist-laboratory`).set('Authorization', `Bearer ${operatorAuthToken}`).send(mockDataEntryData.laboratory).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /lab-reports/:id/persist-laboratory should persist laboratory data for a lab report by supervisor', async () => {
    const response = await request(app.getHttpServer()).patch(`/lab-reports/${supervisorLabReportId}/persist-laboratory`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(mockDataEntryData.laboratory).expect(200);

    expect(response.body).toBeDefined();
  });

  it('POST /lab-reports/:id/refer should return 400 Bad Request if the mockReferLabReport data are invalid', async () => {
    await request(app.getHttpServer())
      .post(`/lab-reports/${operatorLabReportId}/refer`)
      .set('Authorization', `Bearer ${operatorAuthToken}`)
      .send({
        ...mockReferLabReport,
        lab_details: '',
      })
      .expect(400);
  });

  it('POST /lab-reports/:id/refer should refer a lab report', async () => {
    const response = await request(app.getHttpServer()).post(`/lab-reports/${operatorLabReportId}/refer`).set('Authorization', `Bearer ${operatorAuthToken}`).send(mockReferLabReport).expect(201);

    expect(response.body).toBeDefined();
  });

  it('GET /referral-lab-reports should return referral lab reports', async () => {
    const response = await request(app.getHttpServer()).get('/referral-lab-reports').set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('POST /lab-reports/:id/refer/resolve should resolve a referral for a lab report', async () => {
    const response = await request(app.getHttpServer()).post(`/lab-reports/${operatorLabReportId}/refer/resolve`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(201);

    expect(response.body).toBeDefined();
  });

  it('PATCH /lab-reports/:id/data-entry should update lab report data', async () => {
    const response = await request(app.getHttpServer()).patch(`/lab-reports/${operatorLabReportId}/data-entry`).set('Authorization', `Bearer ${operatorAuthToken}`).send(mockDataEntryData).expect(200);

    expect(response.body).toBeDefined();
  });
});
