export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  error: null;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  data: null;
  error: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
