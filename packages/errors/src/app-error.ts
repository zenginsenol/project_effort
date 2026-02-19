import { ERROR_MESSAGES } from './codes';

import type { ErrorCodeType } from './codes';

export interface AppErrorOptions {
  code: ErrorCodeType;
  message?: string;
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly metadata?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    const message = options.message ?? ERROR_MESSAGES[options.code] ?? 'Unknown error';
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.metadata = options.metadata;
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      metadata: this.metadata,
    };
  }
}
