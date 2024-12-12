const { PORT, ENV, HOST, API_PREFIX, BASE_URL } = process.env;

export const coreConfig = {
  port: parseInt(PORT) || 3000,
  host: HOST || 'localhost',
  apiPrefix: API_PREFIX || 'api',
  baseUrl: BASE_URL || 'https://api-dev.pc.com',
  env: ENV || 'development',
};
