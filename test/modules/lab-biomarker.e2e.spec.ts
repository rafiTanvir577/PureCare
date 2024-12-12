import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from 'src/app.module';
import { GetTestUserLoginToken, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { ReferenceRangeType, Role, User } from 'src/entity';
import { LabBiomarkerModel } from 'src/modules/biomarker/repository/lab-biomarker.model';
import { SearchService } from 'src/modules/search/search.service';
import { authConfig } from 'config/auth';
import { UserModel } from 'src/modules/user/repository/user.model';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
const mockSupervisorData = {
  firstName: 'Priya',
  lastName: 'Parvin',
  email: 'supervisor1@pc.com',
  role: Role.DATA_SUPERVISOR,
  password: 'String000000@',
  isEmailVerified: true,
  sessionId: '12345678',
};
const mockBiomarkerData = {
  biomarkerId: '645c91192e250dbbd3bc491d',
  laboratoryId: '64d1dfdbd5121f442c1b10f4',
  uofm: 'm/dl',
  sampleType: 'Plasma',
  reference: {
    type: ReferenceRangeType.NUMERICAL,
    range: [
      {
        from: 1,
        to: 10,
        interpretation: 'Low',
      },
      {
        from: 10,
        to: 20,
        interpretation: 'High',
      },
    ],
  },
};

describe('LabBiomarkerController Testing', () => {
  let app: INestApplication;
  let supervisorAuthToken: string;
  let supervisor: User;
  let labBiomarkerId: string;

  beforeAll(async () => {
    await connectTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    const password = await bcrypt.hash(mockSupervisorData.password, authConfig.salt);
    supervisor = await UserModel.create({
      ...mockSupervisorData,
      password,
    });

    const { token: supervisorToken } = GetTestUserLoginToken(supervisor.id, supervisor.email, Role.DATA_SUPERVISOR, supervisor.sessionId);
    supervisorAuthToken = supervisorToken;

    await app.init();
  }, 10000);

  afterAll(async () => {
    try {
      // Clean up any test data created during tests
      await LabBiomarkerModel.deleteOne({ _id: labBiomarkerId });
      await UserModel.deleteMany({
        id: { $in: [supervisor.id] },
      });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('POST /lab-biomarkers/add should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).post(`/lab-biomarkers/add`).send(mockBiomarkerData).expect(401);
  });

  it('POST /lab-biomarkers/add should return 400 Bad Request if the biomarker data is invalid', async () => {
    await request(app.getHttpServer())
      .post(`/lab-biomarkers/add`)
      .set('Authorization', `Bearer ${supervisorAuthToken}`)
      .send({
        ...mockBiomarkerData,
        reference: '',
      })
      .expect(400);
  });

  it('POST /lab-biomarkers/add should add a lab specific biomarker', async () => {
    // Mock implementation of the Elastic Search addDataToES function
    jest.spyOn(SearchService.prototype, 'addToESLabBiomarker').mockReturnValue('' as any);

    const response = await request(app.getHttpServer()).post(`/lab-biomarkers/add`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(mockBiomarkerData).expect(201);

    expect(response.body).toBeDefined();
    const laboratory = response.body?.data;
    labBiomarkerId = laboratory?._id;
  });

  it('GET /lab-biomarkers/lab-specific/:laboratoryId should return a list of lab-specific biomarkers', async () => {
    const response = await request(app.getHttpServer()).get(`/lab-biomarkers/lab-specific/${mockBiomarkerData.laboratoryId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /lab-biomarkers/:biomarkerId should return a lab-specific biomarker by ID', async () => {
    const response = await request(app.getHttpServer()).get(`/lab-biomarkers/${labBiomarkerId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).query({ laboratoryId: mockBiomarkerData.laboratoryId }).expect(200);

    expect(response.body).toBeDefined();
  });
});
