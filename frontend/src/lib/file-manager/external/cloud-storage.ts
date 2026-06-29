import axios from "axios";

export type CloudStorageType = "tencent_cos" | "aliyun_oss" | "aws_s3" | "qiniu_kodo";

export async function uploadToCloudStorage(
  uploadUrl: string,
  file: File | Blob,
  storageType: CloudStorageType,
  onProgress?: (progress: number) => void,
  contentType?: string
): Promise<void> {
  if (storageType === "qiniu_kodo") {
    await uploadToQiniu(uploadUrl, file, onProgress);
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType || (file instanceof File ? file.type : "") || "application/octet-stream",
  };

  await axios.put(uploadUrl, file, {
    headers,
    onUploadProgress: progressEvent => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
}

/**
 * 七牛云要求 POST multipart/form-data，包含 token、key、file 字段。
 * 后端返回的 uploadUrl 格式: https://up-z0.qiniup.com?token=xxx&key=xxx
 */
async function uploadToQiniu(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  const url = new URL(uploadUrl);
  const token = url.searchParams.get("token");
  const key = url.searchParams.get("key");
  const baseUrl = url.origin + url.pathname;

  if (!token) {
    throw new Error("七牛云上传缺少 token 参数");
  }

  const formData = new FormData();
  formData.append("token", token);
  if (key) {
    formData.append("key", key);
  }
  formData.append("file", file);

  await axios.post(baseUrl, formData, {
    onUploadProgress: progressEvent => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
}

export async function uploadToCOS(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  return uploadToCloudStorage(uploadUrl, file, "tencent_cos", onProgress);
}

export async function uploadToOSS(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  return uploadToCloudStorage(uploadUrl, file, "aliyun_oss", onProgress);
}

export async function uploadToS3(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  return uploadToCloudStorage(uploadUrl, file, "aws_s3", onProgress);
}
