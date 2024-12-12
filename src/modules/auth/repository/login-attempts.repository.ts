import { Injectable } from '@nestjs/common';
import { LoginAttempt, Role } from 'src/entity';
import { LoginAttemptModel } from './login-attempts.model';
import { authConfig } from 'config/auth';
import { SendGridService } from 'src/helper/sendgrid';
import { UserModel } from 'src/modules/user/repository/user.model';
import { Types } from 'mongoose';

@Injectable()
export class LoginAttemptRepository {
  constructor(private mailService: SendGridService) {}

  /**
   * @param {object} data
   * @param {string} data.email
   * @param {Role.ADMIN | Role.PRACTITIONER} data.role The role kind of represents the login path.
   *  There are two login urls.
   *  One is for practitioner and the other is for others.
   */
  async addLoginAttempt(data: { email: string; role: Role.ADMIN | Role.PRACTITIONER; deviceToken: string; ip: string; platform: string; timezone: string }) {
    return await LoginAttemptModel.create(data);
  }

  async updateLoginAttemptAsSuccess(id: string | Types.ObjectId): Promise<LoginAttempt | null> {
    return await LoginAttemptModel.findOneAndUpdate({ _id: new Types.ObjectId(id) }, { isSuccess: true }, { new: true });
  }

  async getLoginAttempts(query: Record<string, any>): Promise<LoginAttempt[] | null> {
    return LoginAttemptModel.find(query).lean();
  }

  async notifyAdminAboutExcessiveLoginAttempts(users: LoginAttempt[]): Promise<void> {
    const owner = await UserModel.findOne({ role: Role.OWNER }).lean();
    const subject = `${users.length > 1 ? 'Multiple users' : 'A user'} Excessive Login Attempts Detected`;
    const message = `${users.length > 1 ? 'Multiple users' : 'A user'} have exceeded the maximum login attempts within a minute.`;

    const userEmails = users.map((user) => user.email).join(', ');
    const emailMessage = `
      <p>Users with excessive login attempts: ${userEmails}</p>
      <p>${message}</p>
    `;

    try {
      const template = this.generateEmailTemplate(subject, 'Dear Owner,', emailMessage, 'Please take appropriate action to address this issue.');
      await this.mailService.sendMail(owner.email, subject, message, template);
    } catch (error) {
      console.error('Failed to send notification email:', error);
    }
  }

  async notifyUserAboutExcessiveLoginAttempts(user: LoginAttempt): Promise<void> {
    const subject = 'Excessive Login Attempts Detected';
    const message = 'Your account has exceeded the maximum login attempts within a minute.';

    try {
      const template = this.generateEmailTemplate(subject, 'Dear User,', message, 'Please ensure the security of your account and consider resetting your password.');
      await this.mailService.sendMail(user.email, subject, message, template);
    } catch (error) {
      console.error(`Failed to send notification email to ${user.email}:`, error);
    }
  }

  public async notifyExcessiveSameIPLoginAttempts(users: LoginAttempt[], ip: string, platform: string, timezone: string): Promise<void> {
    const owner = await UserModel.findOne({ role: Role.OWNER }).lean();
    const subject = `Excessive Login Attempts Detected from same IP`;
    const message = `Excessive login attempts have been detected from same IP involving multiple users within a minute.`;

    const userEmails = users.map((user) => user.email).join(', ');
    const emailMessage = `
      <p>${message}</p>
      <p>Users involved: ${userEmails}</p>
      <p>Device IP: ${ip}</p>
      <p>Device Info: ${platform}</p>
      <p>Device Timezone: ${timezone}</p>
    `;

    try {
      const template = this.generateEmailTemplate(subject, 'Dear Owner,', emailMessage, 'Please take appropriate action to address this issue.');
      await this.mailService.sendMail(owner.email, subject, message, template);
    } catch (error) {
      console.error('Failed to send notification email:', error);
    }
  }

  private generateEmailTemplate(title: string, greeting: string, content: string, closing: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>${title}</title>
      </head>
      <body>
          <h1>${title}</h1>
          <p>${greeting}</p>
          ${content}
          <p>${closing}</p>
          <p>Thank you!</p>
      </body>
      </html>
    `;
  }
}
