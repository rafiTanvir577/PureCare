export enum WaitingListUserLicenseType {
  TEAM = 'Team',
  SINGLE = 'Single',
}

export enum WaitingListUserQualificationStatus {
  EMAIL_SENT = 'email sent',
  FOR_REVIEW = 'certificate for review',
  APPROVED = 'approved',
  REFUSED = 'refused',
}

export class PracticeDetails {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  country: string;
  city: string;
  postalCode: string;
  stateOrProvince?: string;
}

export class WaitingListUser {
  id?: string;
  license: WaitingListUserLicenseType;
  firstName: string;
  lastName: string;
  email: string;
  tmpEmail?: string;
  country: string;
  countryCode: string;
  phone: string;
  qualificationStatus?: string;
  referralSource: string;
  isEmailVerified?: boolean;
  linkExpirationTime?: number;
  verificationToken?: string;
  uploadCertificateExpirationTime?: number;
  uploadCertificateToken?: string;
  certificateURL?: string;
  setPasswordExpirationTime?: number;
  setPasswordToken?: string;
  password?: string;
  resetPasswordToken?: string;
  resetPasswordExpirationTime?: number;
  recoverAccountToken?: string;
  recoverAccountExpirationTime?: number;
  isMfaAdded?: boolean;
  authenticationCode?: string;
  authenticationCodeExpirationTime?: number;
  recoveryCodes?: {
    code: string;
    isUsed?: boolean;
    _id?: string;
  }[];
  practiceDetails?: PracticeDetails;
  deviceTokens?: string[];
  sessionIds?: string[];
}

export class AddToWaitingListRequest extends WaitingListUser {}

export class UpdateWaitingListUserRequest {
  qualificationStatus?: string;
}

export const enum WaitingListErrorMessages {
  SOMETHING_WENT_WRONG = 'Something Went Wrong',
  EMAIL_ALREADY_EXISTS = 'Email already exists',
  CONTACT_US = 'Please contact us if you have a query.',
  INVALID_EMAIL = 'Invalid Credentials',
  INVALID_ID = 'Invalid ID',
  UNMATCHED_PASSWORD = 'Current password does not match',
  UPDATE_PASSWORD_FAILED = 'Could not update your password',
  UPLOAD_CERTIFICATE_FAILED = 'The certificate upload failed.',
  UPDATE_WAITING_LIST_USER_FAILED = 'Update failed.',
  INVALID_TOKEN = 'Invalid token',
  INVALID_CODE = 'Invalid code. Check and try again, or resend code using the link below',
  INVALID_CREDENTIALS = 'Invalid credentials',
}

export const enum ResendLinkErrorMessage {
  ALREADY_VERIFIED = 'Already Verified',
}

export const enum AddToWaitingListSuccessMessage {
  SUCCESS = `Thank you for registering. We'll be in touch shortly.`,
}

export const enum WaitingListSuccessMessages {
  FORGOT_PASSWORD_EMAIL_SENT_SUCCESS = 'Forgot password email sent successfully',
  CHANGE_PASSWORD_SUCCESS = 'Successfully changed your password',
  SUCCESSFULLY_SEND_SMS = 'Successfully sent SMS',
}

export enum WaitingListEmailType {
  VERIFY_EMAIL = 'Verify Email',
  UPLOAD_CERTIFICATE = 'Upload Certificate',
  RESET_PASSWORD = 'Reset password',
  SET_PASSWORD = 'Set Password',
  CHANGE_PASSWORD = 'Change Password',
  REGISTRATION_SUCCESS = 'Registration Successful',
}

export enum WaitingListStatusTypes {
  DEFAULT = 'DEFAULT',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
}

export class WaitingListStatistics {
  date: Date;
  count: number;
}

export enum WaitingListUserAuthenticationCodeTypes {
  RECOVERY_CODE = 'RECOVERY_CODE',
  AUTHENTICATION_CODE = 'AUTHENTICATION_CODE',
}
