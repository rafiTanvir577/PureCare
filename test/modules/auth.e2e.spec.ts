import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from 'src/app.module';
import { connectTestDatabase, disConnectTestDatabase } from '../test-utility';
import { WaitingListModel } from 'src/modules/waiting-list/repository/waiting-list.model';
import { authConfig } from 'config/auth';
import { WaitingListUserAuthenticationCodeTypes, WaitingListUserQualificationStatus } from 'src/entity/waiting-list.entity';
import { SMSService } from 'src/helper/smsService';
import { SendGridService } from 'src/helper/sendgrid';
import { LoginAttemptModel } from 'src/modules/auth/repository/login-attempts.model';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';

describe('Waiting List Authentication', () => {
  let app: INestApplication;
  let authenticationCode: string;
  let recoveryCodes: { code: string }[];

  const mockWaitingListData = {
    license: 'Single',
    firstName: 'Priya',
    lastName: 'Parvin',
    email: 'priya@example.com',
    country: 'United Kingdom',
    countryCode: '+44',
    phone: '1234567890',
    referralSource: 'Conference',
    password: 'String000000@',
    isEmailVerified: true,
    qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
  };
  const mockWaitingListData2 = {
    license: 'Single',
    firstName: 'Priya',
    lastName: 'Parvin',
    email: 'priya2@example.com',
    country: 'United Kingdom',
    countryCode: '+44',
    phone: '1234167890',
    referralSource: 'Conference',
    password: 'String000000@',
    isEmailVerified: true,
    qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
  };
  const mockWaitingListData3 = {
    license: 'Single',
    firstName: 'Priya',
    lastName: 'Parvin',
    email: 'priya3@example.com',
    country: 'United Kingdom',
    countryCode: '+44',
    phone: '1234167890',
    referralSource: 'Conference',
    password: 'String000000@',
    isEmailVerified: true,
    qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
  };

  beforeAll(async () => {
    await connectTestDatabase();
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    // insert data before testing
    try {
      const password = await bcrypt.hash(mockWaitingListData.password, authConfig.salt);
      await WaitingListModel.create({
        ...mockWaitingListData,
        password,
      });
      await WaitingListModel.create({
        ...mockWaitingListData2,
        password,
      });
      await WaitingListModel.create({
        ...mockWaitingListData3,
        password,
      });
    } catch (error) {}

    await app.init();
  }, 10000);

  afterAll(async () => {
    try {
      await WaitingListModel.deleteOne({ email: mockWaitingListData?.email }); // Delete mock data to avoid duplicacy error
      await WaitingListModel.deleteOne({ email: mockWaitingListData2?.email });
      await WaitingListModel.deleteOne({ email: mockWaitingListData3?.email });
      await LoginAttemptModel.deleteOne({ email: mockWaitingListData?.email });
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it('Should fail when email and password are empty (api: /auth/waiting-list/login)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: '',
        password: '',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('email must be an email');
        expect(res._body.message).toContain('email should not be empty');
        expect(res._body.message).toContain('password should not be empty');
      });
  });

  it('Should fail when email is wrong and password is sent (api: /auth/waiting-list/login)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData.email + 'ddd',
        password: mockWaitingListData.password,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
      });
  });

  it('Should fail when email is correct and password does not match (api: /auth/waiting-list/login)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData.email,
        password: mockWaitingListData.password + 'ddd',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
      });
  });

  it('Should pass when email and password are correct (api: /auth/waiting-list/login)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData.email,
        password: mockWaitingListData.password,
        deviceToken: '3466734',
        metaData: {
          platform: 'Linux',
          timezone: 'Asia/Dhaka',
        },
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });
  });

  it('Login Attempts Detected on a Single Device with One Success Email and Password and Also One Correct Email and Wrong Password (api: /auth/waiting-list/login)', async () => {
    jest.spyOn(SendGridService.prototype, 'sendMail').mockReturnValue({} as any);

    await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData.email,
        password: mockWaitingListData.password,
        deviceToken: '3466734',
        metaData: {
          platform: 'Linux',
          timezone: 'Asia/Dhaka',
        },
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });

    await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData2.email,
        password: mockWaitingListData2.password + 'ddd',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
      });

    await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData3.email,
        password: mockWaitingListData3.password + 'ddd',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
      });

    // Then automatically send the same device login.
  }, 10000);

  it('Should show proper error messages for multiple login attempts with wrong email or password (api: /auth/waiting-list/login)', async () => {
    jest.spyOn(SendGridService.prototype, 'sendMail').mockReturnValue({} as any);

    // Make 5 login attempts with wrong credentials
    const maxLoginAttempts = 5;
    for await (const _ of Array(maxLoginAttempts).fill(0)) {
      await request(app.getHttpServer())
        .post('/auth/waiting-list/login')
        .send({
          email: mockWaitingListData.email,
          password: mockWaitingListData.password + 'ddd',
          deviceToken: '3466734',
          metaData: {
            platform: 'Linux',
            timezone: 'Asia/Dhaka',
          },
        })
        .expect(400);
    }

    // Attempt to login after exceeding the maximum attempts
    const response = await request(app.getHttpServer())
      .post('/auth/waiting-list/login')
      .send({
        email: mockWaitingListData.email,
        password: mockWaitingListData.password + 'ddd',
        deviceToken: '3466734',
        metaData: {
          platform: 'Linux',
          timezone: 'Asia/Dhaka',
        },
      })
      .expect(400);

    expect(response.body.message).toContain('You have exceeded the maximum login attempts. Please try again after some time');
  }, 10000);

  it('Should fail when email and phone number are empty (api: /auth/waiting-list/send-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/send-authentication-code')
      .send({
        email: '',
        phone: '',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.error).toContain('Bad Request');
      });
  });

  it('Should fail when email is wrong and phone is sent (api: /auth/waiting-list/send-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/send-authentication-code')
      .send({
        email: mockWaitingListData.email + 'ddd',
        phone: mockWaitingListData.phone,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('Invalid Credentials');
      });
  });

  it('Should pass when email is correct and phone is sent (api: /auth/waiting-list/send-authentication-code)', async () => {
    // Mock implementation of the send sms function
    jest.spyOn(SMSService.prototype, 'sendSMS').mockReturnValue({} as any);

    await request(app.getHttpServer())
      .post('/auth/waiting-list/send-authentication-code')
      .send({
        email: mockWaitingListData.email,
        phone: mockWaitingListData.phone,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });

    try {
      const user = await WaitingListModel.findOne({
        email: mockWaitingListData.email,
      });
      authenticationCode = user.authenticationCode;
    } catch (error) {}
  });

  it('Should fail when email, authenticationCode, and type are empty (api: /auth/waiting-list/verify-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/verify-authentication-code')
      .send({
        email: '',
        authenticationCode: '',
        type: '',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('authenticationCode should not be empty');
      });
  });

  it('Should fail when email, authenticationCode, and type are sent but the email or authenticationCode is wrong (api: /auth/waiting-list/verify-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/verify-authentication-code')
      .send({
        email: mockWaitingListData.email + 'ddd',
        authenticationCode,
        type: WaitingListUserAuthenticationCodeTypes.AUTHENTICATION_CODE,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('Invalid code');
      });
  });

  it('Should pass when email, authenticationCode, and type(AUTHENTICATION_CODE) are sent (api: /auth/waiting-list/verify-authentication-code)', async () => {
    await request(app.getHttpServer())
      .post('/auth/waiting-list/verify-authentication-code')
      .send({
        email: mockWaitingListData.email,
        authenticationCode,
        type: WaitingListUserAuthenticationCodeTypes.AUTHENTICATION_CODE,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
        recoveryCodes = res._body.data?.recoveryCodes;
      });
  });

  it('Should fail when email, authenticationCode, and type(RECOVERY_CODE) are sent but the recovery authenticationCode is wrong (api: /auth/waiting-list/verify-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/verify-authentication-code')
      .send({
        email: mockWaitingListData.email,
        authenticationCode: recoveryCodes?.[0]?.code + '3232',
        type: WaitingListUserAuthenticationCodeTypes.RECOVERY_CODE,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('Recovery code is invalid or is already used');
      });
  });

  it('Should pass when email, authenticationCode, and type(RECOVERY_CODE) are sent (api: /auth/waiting-list/verify-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/verify-authentication-code')
      .send({
        email: mockWaitingListData.email,
        authenticationCode: recoveryCodes?.[0]?.code,
        type: WaitingListUserAuthenticationCodeTypes.RECOVERY_CODE,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });
  });

  it('Should fail when email, authenticationCode, and type(RECOVERY_CODE) are sent but the recovery authenticationCode is already used (api: /auth/waiting-list/verify-authentication-code)', async () => {
    return await request(app.getHttpServer())
      .post('/auth/waiting-list/verify-authentication-code')
      .send({
        email: mockWaitingListData.email,
        authenticationCode: recoveryCodes?.[0]?.code,
        type: WaitingListUserAuthenticationCodeTypes.RECOVERY_CODE,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('Recovery code is invalid or is already used');
      });
  });
});
