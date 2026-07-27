/**
 * DomainError — thrown by AI module for business-logic errors.
 * Used to distinguish our own errors from LLM API errors,
 * so the catch block can re-throw domain errors while wrapping
 * external errors with a generic message (no API key leakage).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
