export abstract class IS3FileUploadService {
  abstract generateFileKey: (fileName: string, featureName?: string) => string;

  abstract getFileKey: (url: string, featureName: string) => string;

  abstract generatePreSignedUrl: (url: string, featureName: string, fileName?: string, type?: string) => Promise<string | null>;

  abstract uploadToS3: (file: Express.Multer.File, key: string, isPublic?: boolean) => Promise<string | null>;
}
