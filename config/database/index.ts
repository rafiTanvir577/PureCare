//import { Dialect } from 'sequelize/types';

const {
  DB,
  MONGODB_URI
} = process.env;
export const
dbConfig = {
  mongodb: {
    URI: MONGODB_URI! || 'mongodb://localhost:27017/ecommerce',
  }
};
