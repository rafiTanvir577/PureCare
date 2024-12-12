import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import * as bcrypt from 'bcrypt';
import { GetTestUserLoginToken, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { Role, User } from 'src/entity';
import { BiomarkerModel } from 'src/modules/biomarker/repository/biomarker.model';
import { BiomarkerConfigModel } from 'src/modules/biomarker/repository/biomarker-config.model';
import { SearchService } from 'src/modules/search/search.service';
import { authConfig } from 'config/auth';
import { UserModel } from 'src/modules/user/repository/user.model';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
const mockSupervisorData = {
  firstName: 'Priya',
  lastName: 'Parvin',
  email: 'supervisor3@pc.com',
  role: Role.DATA_SUPERVISOR,
  password: 'String000000@',
  isEmailVerified: true,
  sessionId: '12345678',
};
const mockBiomarkerConfigData = {
  interpretation: 'Normal',
  unit: 'mg/dL',
};
const mockBiomarkerData = {
  name: 'Blood Test',
};

describe('BiomarkerController Testing', () => {
  let app: INestApplication;
  let supervisorAuthToken: string;
  let biomarkerId: string;
  let unitId: string;
  let supervisor: User;
  let interpretationId: string;

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
      await BiomarkerModel.deleteOne({ _id: biomarkerId });
      await BiomarkerConfigModel.deleteMany({
        _id: { $in: [unitId, interpretationId] },
      });
      await UserModel.deleteMany({
        id: { $in: [supervisor.id] },
      });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('POST /biomarkers/add should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).post(`/biomarkers/add`).send(mockBiomarkerData).expect(401);
  });

  it('POST /biomarkers/add should return 400 Bad Request if the biomarker data is invalid', async () => {
    await request(app.getHttpServer())
      .post(`/biomarkers/add`)
      .set('Authorization', `Bearer ${supervisorAuthToken}`)
      .send({
        name: '',
      })
      .expect(400);
  });

  it('POST /biomarkers/add should add a biomarker', async () => {
    // Mock implementation of the Elastic Search addDataToES function
    jest.spyOn(SearchService.prototype, 'addToESBiomarker').mockReturnValue('' as any);

    const response = await request(app.getHttpServer()).post(`/biomarkers/add`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(mockBiomarkerData).expect(201);

    expect(response.body).toBeDefined();
    const biomarker = response.body?.data;
    biomarkerId = biomarker?._id;
  });

  it('POST /biomarkers/add-unit should add a unit of measurement', async () => {
    const response = await request(app.getHttpServer())
      .post(`/biomarkers/add-unit`)
      .set('Authorization', `Bearer ${supervisorAuthToken}`)
      .send({
        unit: mockBiomarkerConfigData.unit,
      })
      .expect(201);

    expect(response.body).toBeDefined();
    const biomarkerConfig = response.body?.data;
    unitId = biomarkerConfig?._id;
  });

  it('POST /biomarkers/add-interpretation should add an interpretation', async () => {
    const response = await request(app.getHttpServer())
      .post(`/biomarkers/add-interpretation`)
      .set('Authorization', `Bearer ${supervisorAuthToken}`)
      .send({
        interpretation: mockBiomarkerConfigData.interpretation,
      })
      .expect(201);

    expect(response.body).toBeDefined();
    const biomarkerConfig = response.body?.data;
    interpretationId = biomarkerConfig?._id;
  });

  it('GET /biomarkers should return a list of biomarkers', async () => {
    const response = await request(app.getHttpServer()).get(`/biomarkers`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /biomarkers/interpretations should return a list of interpretations', async () => {
    const response = await request(app.getHttpServer()).get(`/biomarkers/interpretations?interpretation=${mockBiomarkerConfigData.interpretation}`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /biomarkers/units should return a list of units of measurement', async () => {
    const response = await request(app.getHttpServer()).get(`/biomarkers/units?unit=${mockBiomarkerConfigData.unit}`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /biomarkers/:id should update a biomarker by ID', async () => {
    // Mock implementation of the Elastic Search addDataToES function
    jest.spyOn(SearchService.prototype, 'updateESBiomarker').mockReturnValue('' as any);

    const updatedData = {
      name: 'Blood',
    };

    const response = await request(app.getHttpServer()).patch(`/biomarkers/${biomarkerId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(updatedData).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /biomarkers/units/:id should update a unit of measurement by ID', async () => {
    const updatedUnitData = {
      unit: 'mmol/L',
    };

    const response = await request(app.getHttpServer()).patch(`/biomarkers/units/${unitId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(updatedUnitData).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /biomarkers/interpretations/:id should update an interpretation by ID', async () => {
    const updatedInterpretationData = {
      interpretation: 'Abnormal',
    };

    const response = await request(app.getHttpServer()).patch(`/biomarkers/interpretations/${interpretationId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(updatedInterpretationData).expect(200);

    expect(response.body).toBeDefined();
  });
});
