import { PathwayMeta, PathwayAttributes } from './pathway.entity';

export class GetPathwayNamesEntity {
  smpdbId: string;
  name: string;
  type: string;
  excerpt: string;
}

export class GetPathwayComponentsEntity {
  meta: PathwayMeta;
  pathway: PathwayAttributes;
  species: number;
  tissues: number;
  cellTypes: number;
  subcellularLocations: number;
  biologicalStates: number;
  compounds: number;
  elementCollections: number;
  nucleicAcids: number;
  proteins: number;
  proteinComplexes: number;
  reactions: number;
  reactionCoupledTransports: number;
  transports: number;
  interactions: number;
}

export class LabTestResponse {
  id: string;
}

export class InviteUserResponse {
  url: string;
  token: string;
}

export class GenToken {
  token: string;
  hashedToken: string;
  expiration: number;
}

export class GetAdminsList {
  id: string;
  email: string;
  invitationDate?: Date;
}
