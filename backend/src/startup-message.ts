export interface StartupConfig {
  version: string;
  host: string;
  port: number;
  apiPrefix: string;
  swaggerPath: string;
  swaggerEnabled: boolean;
}

function formatHost(host: string) {
  const normalizedHost = host.replace(/^\[|\]$/g, '');
  if (normalizedHost === '0.0.0.0' || normalizedHost === '::' || normalizedHost === '*') {
    return 'localhost';
  }
  return normalizedHost.includes(':') ? `[${normalizedHost}]` : normalizedHost;
}

function formatHostForDisplay(host: string) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function normalizePath(path: string) {
  return path.split('/').filter(Boolean).join('/');
}

export function createStartupMessage(config: StartupConfig) {
  const baseUrl = `http://${formatHost(config.host)}:${config.port}`;
  const apiPrefix = normalizePath(config.apiPrefix);
  const lines = [
    `SalamaLine API v${config.version}`,
    'Status: Running',
    `Host: ${formatHostForDisplay(config.host)}:${config.port}`,
    `Local API: ${baseUrl}/${apiPrefix}`,
    `Swagger UI: ${config.swaggerEnabled ? `${baseUrl}/${normalizePath(config.swaggerPath)}` : 'Disabled'}`,
    `Health: ${baseUrl}/${apiPrefix}/health`,
    `Readiness: ${baseUrl}/${apiPrefix}/health/ready`,
  ];
  return lines.join('\n');
}
