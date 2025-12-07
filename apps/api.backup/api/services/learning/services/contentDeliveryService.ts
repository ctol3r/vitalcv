/**
 * B249B-LRN-011: ContentDeliveryService
 *
 * Serves course content: streams video or downloads attachments; integrates with CDN (e.g., S3);
 * supports caching and range requests; tracks download metrics
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface ContentDeliveryOptions {
  range?: string; // HTTP Range header value (e.g., "bytes=0-1023")
  cacheControl?: string;
}

export interface ContentStream {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges: string;
  etag?: string;
  lastModified?: Date;
}

export interface DownloadMetrics {
  userId: string;
  contentUrl: string;
  contentType: string;
  bytesDownloaded: bigint;
  downloadCount: number;
  lastDownloadedAt: Date;
}

export class ContentDeliveryService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private cdnBaseUrl: string | null = null;

  constructor(
    private prisma: PrismaClient,
    options?: {
      s3Region?: string;
      s3Bucket?: string;
      s3AccessKeyId?: string;
      s3SecretAccessKey?: string;
      cdnBaseUrl?: string;
    }
  ) {
    this.bucketName = options?.s3Bucket || process.env.S3_BUCKET_NAME || '';
    this.cdnBaseUrl = options?.cdnBaseUrl || process.env.CDN_BASE_URL || null;

    // Initialize S3 client if credentials are provided
    if (options?.s3AccessKeyId && options?.s3SecretAccessKey) {
      this.s3Client = new S3Client({
        region: options.s3Region || process.env.S3_REGION || 'us-east-1',
        credentials: {
          accessKeyId: options.s3AccessKeyId,
          secretAccessKey: options.s3SecretAccessKey,
        },
      });
    } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  /**
   * Stream video content with range request support
   */
  async streamVideo(
    contentUrl: string,
    options?: ContentDeliveryOptions
  ): Promise<ContentStream> {
    // If using CDN, return CDN URL
    if (this.cdnBaseUrl && contentUrl.startsWith('/')) {
      const fullUrl = `${this.cdnBaseUrl}${contentUrl}`;
      return this.streamFromUrl(fullUrl, options);
    }

    // If S3 URL, use S3 client
    if (this.s3Client && this.isS3Url(contentUrl)) {
      return this.streamFromS3(contentUrl, options);
    }

    // Fallback to direct URL streaming
    return this.streamFromUrl(contentUrl, options);
  }

  /**
   * Download attachment file
   */
  async downloadAttachment(
    contentUrl: string,
    userId: string,
    options?: ContentDeliveryOptions
  ): Promise<ContentStream> {
    const stream = await this.streamVideo(contentUrl, options);

    // Track download metrics
    await this.trackDownload(userId, contentUrl, 'attachment', stream.contentLength || 0n);

    return stream;
  }

  /**
   * Get presigned URL for direct download (for large files)
   */
  async getPresignedUrl(
    contentUrl: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (this.s3Client && this.isS3Url(contentUrl)) {
      const key = this.extractS3Key(contentUrl);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    // For non-S3 URLs, return as-is (or implement other CDN presigning)
    return contentUrl;
  }

  /**
   * Track download metrics
   */
  async trackDownload(
    userId: string,
    contentUrl: string,
    contentType: string,
    bytesDownloaded: bigint
  ): Promise<void> {
    const existing = await this.prisma.contentDownloadMetrics.findFirst({
      where: {
        userId,
        contentUrl,
      },
    });

    if (existing) {
      await this.prisma.contentDownloadMetrics.update({
        where: { id: existing.id },
        data: {
          bytesDownloaded: existing.bytesDownloaded + bytesDownloaded,
          downloadCount: existing.downloadCount + 1,
          lastDownloadedAt: new Date(),
        },
      });
    } else {
      await this.prisma.contentDownloadMetrics.create({
        data: {
          userId,
          contentUrl,
          contentType,
          bytesDownloaded,
          downloadCount: 1,
          lastDownloadedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get download metrics for a user
   */
  async getDownloadMetrics(userId: string): Promise<DownloadMetrics[]> {
    const metrics = await this.prisma.contentDownloadMetrics.findMany({
      where: { userId },
      orderBy: { lastDownloadedAt: 'desc' },
    });

    return metrics.map((m) => ({
      userId: m.userId,
      contentUrl: m.contentUrl,
      contentType: m.contentType,
      bytesDownloaded: m.bytesDownloaded,
      downloadCount: m.downloadCount,
      lastDownloadedAt: m.lastDownloadedAt,
    }));
  }

  /**
   * Stream from S3 with range support
   */
  private async streamFromS3(
    contentUrl: string,
    options?: ContentDeliveryOptions
  ): Promise<ContentStream> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const key = this.extractS3Key(contentUrl);
    const range = this.parseRange(options?.range);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(range && { Range: options?.range }),
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    const stream = response.Body as Readable;
    const contentLength = response.ContentLength;
    const contentType = response.ContentType || 'application/octet-stream';
    const etag = response.ETag;
    const lastModified = response.LastModified;

    // Calculate content range for partial content
    let contentRange: string | undefined;
    if (range && contentLength !== undefined) {
      const totalLength = parseInt(response.ContentRange?.split('/')[1] || String(contentLength));
      contentRange = `bytes ${range.start}-${range.end}/${totalLength}`;
    }

    return {
      stream,
      contentType,
      contentLength: contentLength ? BigInt(contentLength) : undefined,
      contentRange,
      acceptRanges: 'bytes',
      etag,
      lastModified,
    };
  }

  /**
   * Stream from URL (fallback for non-S3 content)
   */
  private async streamFromUrl(
    url: string,
    options?: ContentDeliveryOptions
  ): Promise<ContentStream> {
    // In a real implementation, you would fetch from the URL
    // For now, return a mock stream structure
    // This should be replaced with actual HTTP fetch logic
    const response = await fetch(url, {
      headers: options?.range ? { Range: options.range } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges') || 'bytes';
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    // Convert fetch ReadableStream to Node.js Readable
    const nodeStream = Readable.fromWeb(response.body as any);

    return {
      stream: nodeStream,
      contentType,
      contentLength: contentLength ? BigInt(parseInt(contentLength)) : undefined,
      contentRange: contentRange || undefined,
      acceptRanges,
      etag: etag || undefined,
      lastModified: lastModified ? new Date(lastModified) : undefined,
    };
  }

  /**
   * Check if URL is an S3 URL
   */
  private isS3Url(url: string): boolean {
    return url.includes('s3.amazonaws.com') || url.includes('s3://') || url.startsWith('s3://');
  }

  /**
   * Extract S3 key from URL
   */
  private extractS3Key(url: string): string {
    if (url.startsWith('s3://')) {
      return url.replace('s3://', '').replace(/^[^/]+\//, '');
    }
    if (url.includes('s3.amazonaws.com')) {
      const match = url.match(/s3[^/]*\/[^/]+\/(.+)$/);
      return match ? match[1] : url;
    }
    // Assume it's already a key
    return url;
  }

  /**
   * Parse HTTP Range header
   */
  private parseRange(range?: string): { start: number; end: number } | null {
    if (!range || !range.startsWith('bytes=')) {
      return null;
    }

    const parts = range.replace('bytes=', '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : undefined;

    if (isNaN(start)) {
      return null;
    }

    return {
      start,
      end: end || start + 1024 * 1024, // Default 1MB chunk if end not specified
    };
  }
}

