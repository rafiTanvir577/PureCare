import { Global, Injectable } from '@nestjs/common';
import { sendgridConfig } from 'config/mail';
import * as sendgrid from '@sendgrid/mail';
import * as sendgridClient from '@sendgrid/client';
import { authConfig } from 'config/auth';
sendgrid.setApiKey(sendgridConfig.apiKey);
sendgridClient.setApiKey(sendgridConfig.apiKey);

@Global()
@Injectable()
export class SendGridService {
  async sendMail(to: string, subject: string, text: string, html: string): Promise<boolean | null> {
    try {
      const data = {
        to,
        from: authConfig?.MAIL,
        subject,
        text,
        html,
      };

      const res = await sendgrid.send(data);

      if (!res) return false;
      return true;
    } catch (err) {
      console.log('sendMail err: ', JSON.stringify(err, null, 2));
    }
  }

  async createListIfNotExists(listName: string) {
    // Check if the list already exists
    const getListRequest = {
      url: '/v3/marketing/lists',
      method: 'GET' as any,
    };

    try {
      const [_, responseBody] = await sendgridClient.request(getListRequest);
      const allLists = responseBody.result;

      // Find the specific list by name
      const specificList = allLists.find((list: any) => list.name === listName);

      // If the list doesn't exist, create it
      if (!specificList) {
        const createListRequest = {
          url: '/v3/marketing/lists',
          method: 'POST' as any,
          body: {
            name: listName,
          },
        };

        const [_, createListResponseBody] = await sendgridClient.request(createListRequest);
        return createListResponseBody?.id;
      } else {
        return specificList?.id;
      }
    } catch (error) {
      console.error('Error checking/creating list:', error.response.body);
    }
  }

  async addNewContact(listName: string, data: { email: string; firstName: string; lastName: string }) {
    try {
      const listId = await this.createListIfNotExists(listName);

      const { firstName, lastName, email } = data;
      const addContactRequest = {
        url: '/v3/marketing/contacts',
        method: 'PUT' as any,
        body: {
          contacts: [
            {
              email,
              first_name: firstName,
              last_name: lastName,
            },
          ],
          list_ids: [listId],
        },
      };
      await sendgridClient.request(addContactRequest);
    } catch (error) {
      console.log('Error adding contact:', error.response.body);
    }
  }
}
