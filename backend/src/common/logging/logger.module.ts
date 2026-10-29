import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoOptions } from './redact.config';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...buildPinoOptions(process.env.NODE_ENV === 'production'),
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Only method + path (no query string, no body, no headers) are ever logged.
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: String(req.url).split('?')[0],
          }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        customLogLevel: (_req, res, err) =>
          err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      },
    }),
  ],
})
export class AppLoggerModule {}
