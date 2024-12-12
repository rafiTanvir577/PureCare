export class FileEntity {
  admin: string;
  user?: string;
  destination?: string;
  type: FileTypes;
  fileAttributes: {
    path?: string;
    originalName?: string;
    size?: number;
  }[];
}

export enum FileTypes {
  REPORT = 'REPORT',
  CERTIFICATE = 'CERTIFICATE',
}

export class FileResponse {
  uploadId: string;
  status: string;
  name: string;
  fileId: string;
  uploadTime: Date;
}
