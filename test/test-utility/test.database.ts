import * as Mongoose from 'mongoose';
import { adminData, clientData } from './predefined.data';
Mongoose.set('strictQuery', true);

export const connectTestDatabase = async (): Promise<void> => {
  await Mongoose.connect(process.env.MONGODB_URI);
};

export const disConnectTestDatabase = async (): Promise<void> => {
  await Mongoose.disconnect();
};

export const removeTestCollection = async (collection: string): Promise<void> => {
  await Mongoose.connection.dropCollection(collection);
};

export const insertAdmins = async (): Promise<void> => {
  try {
    const UserModel = Mongoose.connection.db.collection('users');
    const adminExist = await UserModel.findOne({
      email: adminData.email,
    });
    if (!adminExist) await UserModel.insertOne(adminData);
  } catch (error) {
    console.log(error);
  }
};

export const insertClients = async (): Promise<void> => {
  try {
    const UserModel = Mongoose.connection.db.collection('users');
    const clientExist = await UserModel.findOne({
      email: clientData.email,
    });
    if (!clientExist) await UserModel.insertOne(clientData);
  } catch (error) {
    console.log(error);
  }
};
