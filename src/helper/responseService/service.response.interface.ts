export interface ISuccessResponse {
  data?: any;
  code?: number;
  message?: string;
}
export interface SuccessResponse<T> {
  data: T;
  pageCount?: number;
}

export interface DescriptiveError {
  [key: string]: string[];
}

export interface IErrorResponse {
  code?: number;
  errors?: DescriptiveError;
  error: string;
}

export type IServiceResponse = ISuccessResponse | IErrorResponse;

export interface Pagination {
  page: number;
  limit: number;
}
