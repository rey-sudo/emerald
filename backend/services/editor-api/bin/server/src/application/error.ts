export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isPrivate: boolean;

  constructor(
    message: string,
    isPrivate: boolean = true,
    statusCode: number = 500,
  ) {
    super(message);

    this.name = this.constructor.name;

    this.isPrivate = isPrivate;

    this.statusCode = statusCode;

    Error.captureStackTrace(this, this.constructor);
  }
}
