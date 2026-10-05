/** Only explicitly classified argument/configuration failures may be corrected. */
export class RecoverableToolError extends Error {
  constructor(
    public readonly code: 'invalid_configuration' | 'invalid_source_handle',
    message: string,
  ) {
    super(message);
    this.name = 'RecoverableToolError';
  }
}
