/** An RFC 6749 §5.2 error: `{ error, error_description }` with an HTTP status. */
export class OAuthError extends Error {
  constructor(public code: string, public description: string, public status = 400) {
    super(description)
    this.name = 'OAuthError'
  }

  toJSON() {
    return { error: this.code, error_description: this.description }
  }
}
