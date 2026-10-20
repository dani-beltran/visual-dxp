/** Only fixed, application-authored messages may cross the HTTP boundary. */
export class AIServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AIServiceError';
  }
}
