import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import base64url from 'base64url';
import { GetTestUserLoginToken, adminData, connectTestDatabase, disConnectTestDatabase, ownerData } from '../test-utility';
import { WaitingListModel } from 'src/modules/waiting-list/repository/waiting-list.model';
import { WaitingListHelper } from 'src/modules/waiting-list/waiting-list.helper';
import { WaitingListErrorMessages, WaitingListUserLicenseType, WaitingListUserQualificationStatus } from 'src/entity/waiting-list.entity';
import { SendGridService } from 'src/helper/sendgrid';
import { AuditLogModel } from 'src/modules/audit/repositories/audit.model';

describe('Fill registration form testing', () => {
  let app: INestApplication;
  const mockTestPassword = {
    password: 'String1000000@',
  };

  const mockRegistrationData = {
    license: 'Single',
    firstName: 'Priya',
    lastName: 'Parvin',
    email: 'priyaparvin@example.com',
    country: 'United Kingdom',
    countryCode: '+44',
    phone: '0123456789',
    referralSource: 'Conference',
  };
  const { token } = GetTestUserLoginToken(adminData?.id, adminData?.email, adminData?.role);
  let verificationTokenParams: string;
  let uploadCertificateTokenParams: string;
  let setPasswordTokenParams: string;
  let resetPasswordTokenParams: string;
  let userId: string;

  beforeAll(async () => {
    await connectTestDatabase();
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();
  }, 10000);

  afterAll(async () => {
    try {
      await WaitingListModel.deleteOne({ email: mockRegistrationData?.email }); // Delete mock data to avoid duplicacy error
      await AuditLogModel.deleteMany({});
      await disConnectTestDatabase();
      await app.close();
    } catch (error) {}
  });

  it(`Should fail when firstName, lastName or email is empty`, async () => {
    const mockDataWithoutSomeFields = {
      ...mockRegistrationData,
      firstName: '',
      lastName: '',
      email: '',
    };
    return await request(app.getHttpServer())
      .post('/waiting-list/')
      .send(mockDataWithoutSomeFields)
      .expect((res) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('Please fill in First Name');
        expect(res._body.message).toContain('Please fill in Last Name');
        expect(res._body.message).toContain('Please fill in email');
      });
  });

  it(`Should fail when required fields are empty`, async () => {
    return await request(app.getHttpServer())
      .post('/waiting-list/')
      .send({})
      .expect((res) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('Please fill in First Name');
        expect(res._body.message).toContain('Please fill in Last Name');
        expect(res._body.message).toContain('Please fill in email');
        expect(res._body.message).toContain('country should not be empty');
        expect(res._body.message).toContain('countryCode should not be empty');
        expect(res._body.message).toContain('phone should not be empty');
        expect(res._body.message).toContain('referralSource should not be empty');
        expect(res._body.message).toContain('license should not be empty');
        expect(res._body.message).toContain('license must be one of the following values: Team, Single');
      });
  });

  it(`Should pass when everything is correct`, async () => {
    // Mock implementation of the send email and add contact functions
    jest.spyOn(WaitingListHelper.prototype, 'sendEmail').mockReturnValue({});
    jest.spyOn(SendGridService.prototype, 'addNewContact').mockReturnValue({} as any);

    const res = await request(app.getHttpServer())
      .post('/waiting-list/')
      .send(mockRegistrationData)
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
      });

    const user = res.body?.data;
    userId = user?.id;
    const queryParams = `email=${user?.email}&token=${user?.verificationToken}`;
    verificationTokenParams = base64url(Buffer.from(queryParams));
  });

  it(`Should fail when email already exists`, async () => {
    await request(app.getHttpServer())
      .post('/waiting-list/')
      .send(mockRegistrationData)
      .expect((res) => {
        expect(res.statusCode).toBe(400);
      });
  });

  it(`Should redirect to the failed page when the token in the verify email is wrong`, async () => {
    const res = await request(app.getHttpServer()).get(`/waiting-list/verify-email/${verificationTokenParams + 'ddd'}`);
    expect(res.status).toEqual(302);
    expect(res.headers.location).toContain(`http://35.176.74.3/register?status=failed`);
  });

  it(`Should redirect to the success page when the token in the verify email is correct`, async () => {
    // Mock implementation of the send email function
    jest.spyOn(WaitingListHelper.prototype, 'sendEmail').mockReturnValue({});

    const res = await request(app.getHttpServer()).get(`/waiting-list/verify-email/${verificationTokenParams}`);
    expect(res.status).toEqual(302);
    expect(res.headers.location).toContain(`http://35.176.74.3/register?status=success`);

    try {
      const user = await WaitingListModel.findOne({
        email: mockRegistrationData?.email,
      });
      // Generate uploadCertificateTokenParams using bas64 encoded
      const queryParams = `email=${user.email}&token=${user.uploadCertificateToken}`;
      uploadCertificateTokenParams = base64url(Buffer.from(queryParams));
    } catch (error) {}
  });

  it(`Should fail when the uploadCertificateToken is wrong (waiting-list/check-certificate-token/:token)`, async () => {
    await request(app.getHttpServer())
      .get(`/waiting-list/check-certificate-token/${uploadCertificateTokenParams + 'ddd'}`)
      .expect((res: any) => {
        expect(res.statusCode).toBe(200);
        expect(res._body.success).toBe(false);
      });
  });

  it(`Should pass when the uploadCertificateToken is correct (waiting-list/check-certificate-token/:token)`, async () => {
    await request(app.getHttpServer())
      .get(`/waiting-list/check-certificate-token/${uploadCertificateTokenParams}`)
      .expect((res: any) => {
        expect(res.statusCode).toBe(200);
        expect(res._body.success).toBe(true);
      });
  });

  it(`Should fail when the uploadCertificateToken is wrong (waiting-list/upload-certificate/:token) and the certificate url is sent`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/upload-certificate/${uploadCertificateTokenParams + 'ddd'}`)
      .send({ url: 'assets/waiting_list/certificate-url-pdf' })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toBe(WaitingListErrorMessages.UPLOAD_CERTIFICATE_FAILED);
      });
  });

  it(`Should fail when the uploadCertificateToken is correct (waiting-list/upload-certificate/:token) and the certificate url is empty`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/upload-certificate/${uploadCertificateTokenParams}`)
      .send({ url: '' })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('url should not be empty');
      });
  });

  it(`Should pass when the uploadCertificateToken is correct (waiting-list/upload-certificate/:token) and the certificate url is sent`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/upload-certificate/${uploadCertificateTokenParams}`)
      .send({ url: 'assets/waiting_list/certificate-url-pdf' })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });
  });

  it(`Should the update fail if the updated practitioner ID is correct and qualification status is correct but admin token is wrong`, async () => {
    await request(app.getHttpServer())
      .patch(`/waiting-list/update/${userId}`)
      .set('Authorization', `Bearer ${token + 'a'}`)
      .send({
        qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(401);
      });
  });

  it(`Should the update fail if the updated practitioner ID is incorrect and qualification status is correct`, async () => {
    await request(app.getHttpServer())
      .patch(`/waiting-list/update/${userId + 'ddd'}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toBe(WaitingListErrorMessages.UPDATE_WAITING_LIST_USER_FAILED);
      });
  });

  it(`Should the update fail if the updated practitioner ID is correct and qualification status is missing`, async () => {
    await request(app.getHttpServer())
      .patch(`/waiting-list/update/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualificationStatus: '',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('qualificationStatus must be one of the following values: email sent, certificate for review, approved, refused');
      });
  });

  it(`Should the update pass if the updated practitioner ID is correct and qualification status is correct`, async () => {
    //mock implementation of the send email function
    jest.spyOn(WaitingListHelper.prototype, 'sendEmail').mockReturnValue({});

    await request(app.getHttpServer())
      .patch(`/waiting-list/update/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualificationStatus: WaitingListUserQualificationStatus.APPROVED,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(200);
        expect(res._body.data).not.toBe(null);
      });
    try {
      const user = await WaitingListModel.findOne({
        email: mockRegistrationData?.email,
      });
      // Generate setPasswordTokenParams using bas64 encoded
      const queryParams = `email=${user.email}&token=${user.setPasswordToken}`;
      setPasswordTokenParams = base64url(Buffer.from(queryParams));
    } catch (error) {}
  });

  it(`Should fail when the setPasswordToken is wrong (waiting-list/set-password/:token) and the password property is sent`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/set-password/${setPasswordTokenParams + 'ddd'}`)
      .send({ password: mockTestPassword.password })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toBe(WaitingListErrorMessages.INVALID_TOKEN);
      });
  });

  it(`Should fail when the setPasswordToken is correct (waiting-list/set-password/:token) and the password property is empty`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/set-password/${setPasswordTokenParams}`)
      .send({ password: '' })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
      });
  });

  it(`Should pass when the setPasswordToken is correct (waiting-list/set-password/:token) and the password property is sent`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/set-password/${setPasswordTokenParams}`)
      .send({ password: mockTestPassword.password })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });
  });

  it(`Should fail when the email property is empty (waiting-list/forgot-password)`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/forgot-password`)
      .send({
        email: '',
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toContain('email should not be empty');
      });
  });

  it(`Should pass when the email property is sent (waiting-list/forgot-password)`, async () => {
    // Mock implementation of the send email function
    jest.spyOn(WaitingListHelper.prototype, 'sendEmail').mockReturnValue({});

    await request(app.getHttpServer())
      .post(`/waiting-list/forgot-password`)
      .send({
        email: mockRegistrationData.email,
      })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });
    try {
      const user = await WaitingListModel.findOne({
        email: mockRegistrationData.email,
      });
      // Generate setPasswordTokenParams using bas64 encoded
      const queryParams = `email=${user.email}&token=${user.resetPasswordToken}`;
      resetPasswordTokenParams = base64url(Buffer.from(queryParams));
    } catch (error) {}
  });

  it(`Should fail when the resetPasswordToken is wrong (waiting-list/reset-password/:token) and the password property is sent`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/reset-password/${resetPasswordTokenParams + 'ddd'}`)
      .send({ password: mockTestPassword.password })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
        expect(res._body.message).toBe(WaitingListErrorMessages.INVALID_TOKEN);
      });
  });

  it(`Should fail when the resetPasswordToken is correct (waiting-list/reset-password/:token) and the password property is empty`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/reset-password/${resetPasswordTokenParams}`)
      .send({ password: '' })
      .expect((res: any) => {
        expect(res.statusCode).toBe(400);
      });
  });

  it(`Should pass when the resetPasswordToken is correct (waiting-list/reset-password/:token) and the password property is sent`, async () => {
    await request(app.getHttpServer())
      .post(`/waiting-list/reset-password/${resetPasswordTokenParams}`)
      .send({ password: mockTestPassword.password })
      .expect((res: any) => {
        expect(res.statusCode).toBe(201);
        expect(res._body.data).not.toBe(null);
      });
  });
});

describe('View practitioner details', () => {
  let app: INestApplication;

  const mockRegistrationData2 = {
    license: 'Team',
    firstName: 'Yadav',
    lastName: 'Panday',
    email: 'yadav@example.com',
    country: 'United States',
    countryCode: '+44',
    phone: '1234567890',
    referralSource: 'Event',
  };

  const { token } = GetTestUserLoginToken(ownerData?.id, ownerData?.email, ownerData?.role);

  beforeAll(async () => {
    await connectTestDatabase();
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    // insert data before testing
    try {
      await WaitingListModel.create(mockRegistrationData2);
    } catch (error) {}

    await app.init();
  }, 10000);

  afterAll(async () => {
    await disConnectTestDatabase();
    await app.close();
  });

  it(`Should show list of practitioners when no filter applied`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user).toMatchObject({
            firstName: expect.any(String),
            lastName: expect.any(String),
            email: expect.any(String),
            phone: expect.any(String),
            country: expect.any(String),
            countryCode: expect.any(String),
            referralSource: expect.any(String),
          });
          expect([WaitingListUserLicenseType.SINGLE, WaitingListUserLicenseType.TEAM]).toContain(user.license);
        });
      });
  });

  it(`Should properly filter by first name (case-insensitive)`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?firstName="yaDaV"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.firstName).toMatch(/yaDav/i);
        });
      });
  });

  it(`Should properly filter by last name (case-insensitive)`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?lastName="panDay"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.lastName).toMatch(/panDay/i);
        });
      });
  });

  it(`Should properly filter by email (case-insensitive)`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?email="yadav"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.email).toMatch(/yadav/i);
        });
      });
  });

  it(`Should properly filter by license`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?license="Team"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.license).toMatch('Team');
        });
      });
  });

  it(`Should properly filter by phone (case-insensitive)`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?phone="12345"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.phone).toMatch(/12345/i);
        });
      });
  });

  it(`Should properly filter by countryCode (case-insensitive)`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?countryCode="+44"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.countryCode).toMatch(/\+44/i);
        });
      });
  });

  it(`Should properly filter by referralSource (case-insensitive)`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?referralSource="event"')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.referralSource).toMatch(/event/i);
        });
      });
  });

  it(`Should properly filter by email verification status`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?isEmailVerified=true')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        res._body.data.forEach((user) => {
          expect(user.isEmailVerified).toEqual(true);
        });
      });
  });

  it(`Should properly sort by firstname`, async () => {
    return await request(app.getHttpServer())
      .get('/waiting-list/all?sortBy="firstName"&sort=1')
      .set('Authorization', `Bearer ${token}`)
      .expect((res) => {
        expect(res.statusCode).toBe(200);
        // expect to be sorted by first name
        const expectedData = res._body.data.sort((userA, userB) => (userA?.firstName === userB?.firstName ? 0 : userA?.firstName < userB?.firstName ? -1 : 1));
        expect(res._body.data).toStrictEqual(expectedData);
      });
  });
});
