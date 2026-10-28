export type ErrorCode =
  | "network"
  | "timeout"
  | "aborted"
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "storage"
  | "request";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status?: number,
  ) {
    // Never retain response bodies, request URLs, credentials or native error causes.
    super(code);
    this.name = "AppError";
  }
}

export function errorCopy(error: unknown): string {
  if (!(error instanceof AppError))
    return "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
  switch (error.code) {
    case "network":
      return "네트워크에 연결할 수 없습니다. 연결 상태를 확인해 주세요.";
    case "timeout":
      return "응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.";
    case "unauthorized":
      return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    case "forbidden":
      return "접근 권한이 없습니다. 워크스페이스 관리자에게 확인해 주세요.";
    case "storage":
      return "안전한 로그인 저장소를 사용할 수 없습니다. 기기 잠금 상태를 확인하고 다시 시도해 주세요.";
    case "invalid":
      return "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      if (error.status === 429)
        return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
      return "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
  }
}
