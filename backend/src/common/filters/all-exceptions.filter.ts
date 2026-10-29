import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Returns clean JSON errors and never leaks internals (stack traces, SQL, request bodies). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      return res.status(exception.getStatus()).json(exception.getResponse());
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'Conflict' });
      if (exception.code === 'P2025') return res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'Not found' });
    }
    // Log only the error class/code, never the message (it can embed query parameters).
    this.logger.error(`Unhandled error: ${exception instanceof Error ? exception.name : 'unknown'}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
  }
}
