export type CoreErrorCode = 'CATALOG_INVALID' | 'UNKNOWN_DOCS_TOPIC' | 'DOCS_UNAVAILABLE';

export class CoreError extends Error {
  constructor(public readonly code: CoreErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreError';
  }
}
