export const enum SignUpErrorMessage {
  INVALID_CREDENTIALS = 'Invalid Credentials',
  CANNOT_CREATE_USER = 'Cannot Create User',
}

export const enum LoginErrorMessage {
  INVALID_CREDENTIALS = 'Invalid Credentials',
  ACCOUNT_ERROR = 'Account error. Please contact us for help.',
  CANNOT_LOG_IN = 'Cannot Login',
}

export const enum FileUploadSuccessMessage {
  FILE_UPLOAD_SUCCESS = 'Successfully Updated the file',
}

export const enum RelationshipErrorMessage {
  INVALID_REQUEST = 'Invalid Request',
  COULD_NOT_FETCH = 'Could not fetch RELATIONSHIPS',
  COULD_NOT_UPDATE_RELATIONSHIP = 'Could not update Relationship',
}

export const enum RelationshipSuccessMessage {
  SUCCESSFULLY_FETCHED_EDGES = 'Successfully fetched the Edges',
  SUCCESSFULLY_UPDATED_RELATIONSHIP = 'Successfully updated Relationship',
  SUCCESSFULLY_FETCHED_RELATIONSHIP = 'Successfully fetched the Relationship',
}

export const enum UpdateUserErrorMessage {
  INVALID_CREDENTIALS = 'Invalid Credentials',
  CANNOT_UPDATE_USER = 'Cannot update user',
  CANNOT_UPDATE_PASSWORD = 'Cannot update password',
  TIME_EXPIRED = 'Time expired',
}
