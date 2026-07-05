/**
 * Upload session stored in memory per D-94.
 * Sessions have a 24h TTL and are cleaned up every 60 seconds.
 */
export interface UploadSession {
  /** UUID session identifier */
  sessionId: string;
  /** Owner user DB ID */
  ownerId: number;
  /** Storage policy DB ID */
  policyId: number;
  /** Full target URI (e.g., anzhiyu://my/images/photo.jpg) */
  uri: string;
  /** Chunk size in bytes */
  chunkSize: number;
  /** Total file size in bytes */
  fileSize: number;
  /** Temp entity DB ID created during session */
  tempEntityId: number;
  /** Set of uploaded chunk indices */
  uploadedChunks: Set<number>;
  /** Expiration time */
  expireAt: Date;
  /** Whether to overwrite existing file */
  overwrite: boolean;
}

export const UPLOAD_SESSION_EXPIRE_HOURS = 24;
