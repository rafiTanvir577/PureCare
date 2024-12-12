import { Injectable } from '@nestjs/common';

interface AdditionalProperty {
  [key: string]: any;
}

export interface IResponse<T> {
  data?: T | T[];
  [key: string]: any;
}

@Injectable()
export class APIResponse {
  /**
   * Create a success response
   * This will help to create a structured response for all API
   *
   * @param {*} data array or object we want to return
   * @param {*} [additionalProperty={}] for array response we can add additional information like pagination info
   * @return {*}
   * @memberof Response
   */
  success<T extends object>(data?: T | T[], additionalProperty: AdditionalProperty = {}) {
    return { ...additionalProperty, data };
  }
}
