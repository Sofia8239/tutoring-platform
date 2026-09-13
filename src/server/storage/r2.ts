import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

/**
 * Cloudflare R2 (S3-compatible) storage for homework uploads. Feature-flagged:
 * without the four core vars the whole file-upload path is hidden and submissions
 * are text-only.
 *
 * Objects are never public — reads go through short-lived presigned GET URLs;
 * the AI review downloads bytes server-side.
 */

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET,
  );
}

let cached: { client: S3Client; bucket: string } | null = null;

function r2(): { client: S3Client; bucket: string } {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }
  if (!cached) {
    cached = {
      client: new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID as string,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
        },
      }),
      bucket: env.R2_BUCKET as string,
    };
  }
  return cached;
}

const URL_TTL_SECONDS = 600;

export async function createUploadUrl(input: {
  key: string;
  contentType: string;
}): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

export async function createDownloadUrl(key: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** Download an object's bytes as base64 — used to feed the AI review. */
export async function fetchObjectBase64(key: string): Promise<string> {
  const { client, bucket } = r2();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error(`R2 object ${key} has no body`);
  return Buffer.from(bytes).toString("base64");
}
