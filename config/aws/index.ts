const {
  AWS_S3_API_VERSION,
  AWS_S3_BUCKET_NAME,
  AWS_S3_PUBLIC_BUCKET_NAME,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SIGNATURE_VERSION,
  AWS_REGION,
  AWS_PRESIGNED_EXPIRE_TIME,
} = process.env;

export const awsConfig = {
  aws_s3_apiVersion: AWS_S3_API_VERSION || '',
  aws_s3_bucketName: AWS_S3_BUCKET_NAME || '',
  aws_s3_public_bucketName: AWS_S3_PUBLIC_BUCKET_NAME || '',
  aws_accessKeyId: AWS_ACCESS_KEY_ID || '',
  aws_secretAccessKey: AWS_SECRET_ACCESS_KEY || '',
  aws_region: AWS_REGION || '',
  aws_presigned_expire_time: parseInt(AWS_PRESIGNED_EXPIRE_TIME) || 600, // In seconds
  aws_signatureVersion: AWS_SIGNATURE_VERSION || 'v4',
};
