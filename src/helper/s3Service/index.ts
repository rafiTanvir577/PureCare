import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as message from 'aws-sdk/lib/maintenance_mode_message';
message.suppress = true;
import { awsConfig } from 'config/aws';

@Injectable()
export class S3FileUploadService {
  private s3: AWS.S3;
  private bucketName: string;
  private publicBucketName: string;
  private presignedExpireTime: number;

  constructor() {
    const { aws_s3_apiVersion, aws_s3_bucketName, aws_s3_public_bucketName, aws_accessKeyId, aws_secretAccessKey, aws_region, aws_presigned_expire_time, aws_signatureVersion } = awsConfig;

    this.bucketName = aws_s3_bucketName;
    this.publicBucketName = aws_s3_public_bucketName;
    this.presignedExpireTime = aws_presigned_expire_time;
    this.s3 = new AWS.S3({
      apiVersion: aws_s3_apiVersion,
      accessKeyId: aws_accessKeyId,
      secretAccessKey: aws_secretAccessKey,
      region: aws_region,
      signatureVersion: aws_signatureVersion,
    });
  }

  generateFileKey(fileName: string, featureName: string): string {
    // Extract file extension
    const fileExtension = fileName?.split('.')?.pop();
    const currentTime = new Date();
    // key = assets/feature-name/filename-timestamp.extension
    const key = `assets/${featureName}/${fileName}-${currentTime.toJSON()}.${fileExtension}`;
    return key;
  }

  getFileKey(url: string, featureName: string) {
    return url.substring(url.lastIndexOf(featureName), url.length);
  }

  async generatePreSignedUrl(url: string, featureName: string, fileName?: string, type?: string): Promise<string | null> {
    try {
      const key = url ? this.getFileKey(url, featureName) : fileName;
      if (!key) return null;
      const presignedParam = {
        Bucket: this.bucketName,
        Key: key,
        Expires: this.presignedExpireTime,
      };
      return await this.s3.getSignedUrlPromise(type || 'getObject', presignedParam);
    } catch (error) {
      console.log(error.message);
      return null;
    }
  }

  async uploadToS3(file: Express.Multer.File, key: string, isPublic = false): Promise<string | string> {
    try {
      const s3uploadParams = {
        Bucket: isPublic ? this.publicBucketName : this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      // upload to s3 bucket
      const uploadPromise = await this.s3.upload(s3uploadParams).promise();
      return uploadPromise.Location;
    } catch (error) {
      console.log('Error in upload to s3: ', error);
      return null;
    }
  }

  async generatePreSignedUrlForDelete(key: string): Promise<string | null> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: this.presignedExpireTime,
      };

      const url = await this.s3.getSignedUrlPromise('deleteObject', params);

      return url;
    } catch (error) {
      console.error(`Error generating pre-signed URL for delete: ${error.message}`);
      return null;
    }
  }

  async deleteFileWithPreSignedUrl(url: string, featureName: string): Promise<boolean> {
    try {
      const key = this.getFileKey(url, featureName);

      if (!key) {
        // Handle the case where the key couldn't be determined
        return false;
      }

      const params = {
        Bucket: this.bucketName,
        Key: key,
      };

      // Check if the object exists before attempting to delete it
      await this.s3.headObject(params).promise();

      // The object exists, proceed with generating and using the delete URL
      const deleteUrl = await this.generatePreSignedUrlForDelete(key);

      if (!deleteUrl) {
        // Handle the case where the pre-signed URL couldn't be generated
        return false;
      }

      // Make a DELETE request to the pre-signed URL to delete the object
      await fetch(deleteUrl, { method: 'DELETE' });
      return true;
    } catch (error) {
      console.error(`Error deleting file with pre-signed URL: ${error.message}`);
      return false;
    }
  }

  async getSinglePublicFile(url: string, featureName = ''): Promise<string> {
    const key = await new S3FileUploadService().generatePreSignedUrl(url, featureName, 'getObject');

    return key;
  }
}
