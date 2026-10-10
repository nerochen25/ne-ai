import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown, requestId = crypto.randomUUID()) {
  const known = error instanceof AppError;
  const invalid = error instanceof ZodError || error instanceof SyntaxError;
  const status = known ? error.status : invalid ? 400 : 500;
  if (status >= 500)
    console.error(
      JSON.stringify({
        event: "request_failed",
        requestId,
        code: known ? error.code : "INTERNAL",
      }),
    );
  return Response.json(
    {
      error: {
        code: known ? error.code : invalid ? "INVALID_INPUT" : "INTERNAL",
        message: known
          ? error.message
          : invalid
            ? "Check your input and try again."
            : "The request could not be completed. Please try again.",
        requestId,
      },
    },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    },
  );
}
