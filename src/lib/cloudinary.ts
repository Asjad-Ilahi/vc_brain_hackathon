import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

const isConfigured = !!(
  env.cloudinaryCloudName &&
  env.cloudinaryApiKey &&
  env.cloudinaryApiSecret
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

/**
 * Uploads a file buffer directly to Cloudinary.
 * If credentials are not configured, it skips and returns null gracefully.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string = "pitch-decks"
): Promise<string | null> {
  if (!isConfigured) {
    console.warn("Cloudinary credentials not configured. Skipping file upload.");
    return null;
  }

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto", // handles both PDFs and image assets
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload failed:", error);
          resolve(null); // fail soft to prevent intake pipeline crashes
        } else {
          resolve(result?.secure_url ?? null);
        }
      }
    );

    uploadStream.end(buffer);
  });
}
