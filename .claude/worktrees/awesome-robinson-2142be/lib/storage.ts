import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const B2_ENDPOINT = (process.env.B2_ENDPOINT || 's3.us-west-004.backblazeb2.com').trim();
const B2_KEY_ID = process.env.B2_KEY_ID?.trim();
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY?.trim();
const BUCKET_NAME = process.env.B2_BUCKET_NAME?.trim();

const formatEndpoint = (endpoint: string): string => {
  return endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
};

const extractRegion = (endpoint: string): string => {
  const match = endpoint.match(/s3\.([^.]+)\.backblazeb2\.com/);
  return match ? match[1] : 'us-west-004';
};

function getS3Client(): S3Client {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY || !BUCKET_NAME) {
    throw new Error('Missing B2 env vars: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME');
  }
  return new S3Client({
    region: extractRegion(B2_ENDPOINT),
    endpoint: formatEndpoint(B2_ENDPOINT),
    credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APPLICATION_KEY },
    forcePathStyle: true,
  });
}

export interface UploadResult {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  expiresAt: string;
}

export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string,
  retentionHours: number = 1,
): Promise<UploadResult> {
  const client = getS3Client();
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionHours * 60 * 60 * 1000);

  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME!,
    Key: id,
    Body: file,
    ContentType: contentType,
    Metadata: {
      originalname: filename,
      contenttype: contentType,
      uploadedat: now.toISOString(),
      expiresat: expiresAt.toISOString(),
    },
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    id,
    url: `${appUrl}/api/file-host/${id}`,
    filename,
    contentType,
    size: file.length,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getFile(id: string): Promise<{ data: Buffer; contentType: string; metadata: Record<string, string> } | null> {
  const client = getS3Client();

  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME!,
      Key: id,
    }));

    if (!response.Body) return null;

    // Check expiry
    const expiresAt = response.Metadata?.expiresat;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return null; // expired
    }

    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return {
      data: Buffer.concat(chunks),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata || {},
    };
  } catch {
    return null;
  }
}

export async function deleteFile(id: string): Promise<boolean> {
  const client = getS3Client();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME!, Key: id }));
    return true;
  } catch {
    return false;
  }
}
