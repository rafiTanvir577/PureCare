const { GRAFANA_HOST, LOGGER_APP_NAME, GRAFANA_USER_ID, GRAFANA_PASSWORD } = process.env;

export const loggerConfig = {
  host: GRAFANA_HOST || '',
  app_name: LOGGER_APP_NAME || 'pc',
  userId: GRAFANA_USER_ID || '',
  password: GRAFANA_PASSWORD || '',
};
