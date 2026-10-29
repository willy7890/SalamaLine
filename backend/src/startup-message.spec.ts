import { createStartupMessage } from './startup-message';

describe('createStartupMessage', () => {
  const baseConfig = {
    version: '1.0.0',
    host: '0.0.0.0',
    port: 3000,
    apiPrefix: 'api/v1',
    swaggerPath: 'docs',
    swaggerEnabled: true,
  };

  it('prints the configured API, Swagger, and health URLs', () => {
    expect(createStartupMessage(baseConfig)).toBe([
      'SalamaLine API v1.0.0',
      'Status: Running',
      'Host: 0.0.0.0:3000',
      'Local API: http://localhost:3000/api/v1',
      'Swagger UI: http://localhost:3000/docs',
      'Health: http://localhost:3000/api/v1/health',
      'Readiness: http://localhost:3000/api/v1/health/ready',
    ].join('\n'));
  });

  it('uses a configured host and indicates when Swagger is disabled', () => {
    expect(createStartupMessage({
      ...baseConfig,
      host: '127.0.0.1',
      port: 8080,
      apiPrefix: '/custom/api/',
      swaggerEnabled: false,
    })).toContain([
      'Host: 127.0.0.1:8080',
      'Local API: http://127.0.0.1:8080/custom/api',
      'Swagger UI: Disabled',
      'Health: http://127.0.0.1:8080/custom/api/health',
      'Readiness: http://127.0.0.1:8080/custom/api/health/ready',
    ].join('\n'));
  });
});
