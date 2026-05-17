import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import sharp from "sharp";
import { Readable } from "stream";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.getOrThrow<string>("CLOUDINARY_API_KEY"),
      api_secret: this.config.getOrThrow<string>("CLOUDINARY_API_SECRET"),
    });
  }

  async uploadImage(
    buffer: Buffer,
    mimeType: string,
    folder: "avatars" | "logos" | "clinic-assets" | "payment-proofs",
    publicIdPrefix?: string,
  ): Promise<string> {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimes.includes(mimeType)) {
      throw new BadRequestException(
        "Only JPG, PNG, WEBP, and GIF images are allowed",
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException("Image size must be less than 5MB");
    }

    // Compress & resize using sharp
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      this.logger.warn("Sharp processing failed, uploading original");
      processedBuffer = buffer;
    }

    const publicId = publicIdPrefix
      ? `clinic-cms/${folder}/${publicIdPrefix}-${Date.now()}`
      : `clinic-cms/${folder}/${Date.now()}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: `clinic-cms/${folder}`,
          overwrite: true,
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            reject(new BadRequestException(error?.message ?? "Upload failed"));
            return;
          }
          resolve(result.secure_url);
        },
      );

      const readable = new Readable();
      readable.push(processedBuffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  // FIX-1: Added mimeType param so PDFs (resource_type:'raw') get the correct signed URL.
  // Previously all files were signed as resource_type:'image' which broke PDF URLs entirely.
  generateSignedUrl(
    publicId: string,
    expiresInSeconds = 300,
    mimeType?: string,
  ): string {
    return cloudinary.url(publicId, {
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      resource_type: mimeType === "application/pdf" ? "raw" : "image",
    });
  }

  async uploadPatientFile(
    buffer: Buffer,
    mimeType: string,
    publicIdPrefix?: string,
  ): Promise<string> {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!allowedMimes.includes(mimeType)) {
      throw new BadRequestException("Only image and PDF files are allowed");
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException("File size must be less than 10MB");
    }

    const publicId = publicIdPrefix
      ? `clinic-cms/patient-files/${publicIdPrefix}-${Date.now()}`
      : `clinic-cms/patient-files/${Date.now()}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "clinic-cms/patient-files",
          overwrite: true,
          resource_type: mimeType === "application/pdf" ? "raw" : "image",
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            reject(new BadRequestException(error?.message ?? "Upload failed"));
            return;
          }
          // FIX-2: Was returning result.public_id — correct for signing.
          // Keeping public_id (storageKey) as the stored value is right,
          // but the original code was already doing this correctly here.
          resolve(result.public_id);
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }
}
