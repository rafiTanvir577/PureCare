import { ChildTypes } from 'src/entity/relationship.pattern.entity';
import { ParentTypes } from 'src/entity/relationship.pattern.entity';

export class InviteClientRequest {
  email: string;
}

export class InviteRequest {
  email: string;
  admin: string;
}

export class InviteTeamMemberRequest extends InviteRequest {
  features: string[];
}

export class FileUploadInviteRequest {
  email: string;
}

export class SignupByInvitationRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export class FilteredEdgeQuery {
  componenttype?: string;
  componentid?: number;
  legend: string;
  legendsubtypeid?: number;
}

export class GetRelationshipPatternComponents {
  edgeName: string;
  relation: string;
}

export class UpdateRelationshipPatternRequest {
  parent: ParentTypes;
  child: ChildTypes;
}

export class UpdateReltationshipComponents {
  relationships: UpdateRelationshipPatternRequest[];
}

export class UpdateUserAdmins {
  adminId: string;
}

export enum GetAdminsEnum {
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  APPROVED = 'APPROVED',
}

export class GetPathwayFilter {
  name: string;
  tag: string;
}
