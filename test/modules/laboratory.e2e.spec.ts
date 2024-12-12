import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import * as bcrypt from 'bcrypt';
import { GetTestUserLoginToken, connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { Role, User } from 'src/entity';
import { LaboratoryModel } from 'src/modules/laboratory/repository/laboratory.model';
import { authConfig } from 'config/auth';
import { UserModel } from 'src/modules/user/repository/user.model';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';
import { SendGridService } from 'src/helper/sendgrid';
const mockSupervisorData = {
  firstName: 'Priya',
  lastName: 'Parvin',
  email: 'superviso2r@pc.com',
  role: Role.DATA_SUPERVISOR,
  password: 'String000000@',
  isEmailVerified: true,
  sessionId: '12345678',
};
const mockLaboratoryData = {
  name: 'Lab Corp',
  email: 'labcorp@gmail.com',
  website: 'www.lab-corp.com',
  address: {
    first_line: 'test',
    town: 'test',
    country: 'UK',
    zip_code: '12345',
  },
};

describe('Initializing Laboratory Controller Testing', () => {
  let app: INestApplication;
  let supervisorAuthToken: string;
  let labId: string;
  let supervisor: User;

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
      await LaboratoryModel.deleteOne({
        _id: labId,
      });
      await UserModel.deleteMany({
        id: { $in: [supervisor.id] },
      });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('POST /laboratories/add should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).post(`/laboratories/add`).send(mockLaboratoryData).expect(401);
  });

  it('POST /laboratories/add should return 400 Bad Request if the mockLaboratoryData data are invalid', async () => {
    await request(app.getHttpServer())
      .post(`/laboratories/add`)
      .set('Authorization', `Bearer ${supervisorAuthToken}`)
      .send({
        ...mockLaboratoryData,
        name: '',
      })
      .expect(400);
  });

  it('POST /laboratories/add should add a laboratory', async () => {
    jest.spyOn(SendGridService.prototype, 'sendMail').mockReturnValue({} as any);

    const response = await request(app.getHttpServer()).post(`/laboratories/add`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(mockLaboratoryData).expect(201);

    expect(response.body).toBeDefined();
    const laboratory = response.body?.data;
    labId = laboratory?._id;
  });

  it('GET /laboratories should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get('/laboratories').expect(401);
  });

  it('GET /laboratories should return a list of laboratories', async () => {
    const response = await request(app.getHttpServer()).get(`/laboratories`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('GET /laboratories/:id should return 401 Unauthorized if no token is provided', async () => {
    await request(app.getHttpServer()).get(`/laboratories/${labId}`).expect(401);
  });

  it('GET /laboratories/:id should return a single laboratory by ID', async () => {
    const response = await request(app.getHttpServer()).get(`/laboratories/${labId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('PATCH /laboratories/:id should return 401 Unauthorized if no token is provided', async () => {
    const updatedData = {
      name: 'New Lab Crop',
    };

    await request(app.getHttpServer()).patch(`/laboratories/${labId}`).send(updatedData).expect(401);
  });

  it('PATCH /laboratories/:id should return 400 Bad Request if the update data is invalid', async () => {
    const invalidData = {
      name: '', // Empty name
    };

    await request(app.getHttpServer()).patch(`/laboratories/${labId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(invalidData).expect(400);
  });

  it('PATCH /laboratories/:id should update a laboratory by ID', async () => {
    const updatedData = {
      name: 'New Lab Crop',
    };

    const response = await request(app.getHttpServer()).patch(`/laboratories/${labId}`).set('Authorization', `Bearer ${supervisorAuthToken}`).send(updatedData).expect(200);

    expect(response.body).toBeDefined();
  });
});
