import { PERMISSIONS } from './permissions.enum';
import { Role } from './role.entity';

export class Invitation {
  email: string;
  token: string;
  type: string;
  role?: Role;
  expiration: number;
  isValid?: boolean;
  features?: string[];
  admin?: string;
  userId?: string;
}
