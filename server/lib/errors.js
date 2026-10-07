export class HttpError extends Error {
  // publicMessage is the only text a client ever sees for this error (see
  // publicErrorMessage). message stays internal and goes to the server log.
  constructor(message, status, { publicMessage, code } = {}) {
    super(message);
    this.status = status;
    if (publicMessage) this.publicMessage = publicMessage;
    if (code) this.code = code;
  }
}

export const SEARCH_UNSUPPORTED = "search_unsupported";

// Provider errors carry raw upstream text ("DeepSeek error (400): …",
// configuration hints naming env vars). Clients get a fixed, safe message
// instead; the full error is logged by the route.
export function publicErrorMessage(error) {
  if (error?.publicMessage) return error.publicMessage;
  if (error?.status === 429) return "The AI service is busy. Please wait a minute and try again.";
  return "The AI request failed. Please try again.";
}
