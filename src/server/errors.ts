export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class OriginRejectedError extends AppError {
  constructor() {
    super("Identitas atau kata sandi tidak cocok. Periksa lalu coba lagi.", 401);
  }
}

export class IntegrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export class OriginDownError extends AppError {
  constructor(message = "Layanan masuk sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat.") {
    super(message, 503);
  }
}
