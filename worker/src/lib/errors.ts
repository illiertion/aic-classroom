export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = (message = "로그인이 필요합니다.") =>
  new ApiError(401, "unauthorized", message);

export const forbidden = (message = "이 작업을 수행할 권한이 없습니다.") =>
  new ApiError(403, "forbidden", message);

export const notFound = (message = "대상을 찾을 수 없습니다.") =>
  new ApiError(404, "not_found", message);

export const badRequest = (message: string, code = "bad_request") =>
  new ApiError(400, code, message);

export const conflict = (message: string, code = "conflict") => new ApiError(409, code, message);

export const tooLarge = (message: string) => new ApiError(413, "payload_too_large", message);
