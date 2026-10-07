/**
 * Client-side high performance file pre-processor and image compressor.
 * Enforces a strict 15MB maximum size limit for PDFs, documents, and images.
 * Downscales images to max 1600px / 0.80 JPEG to prevent payload bloat,
 * and reads PDF/Word documents directly as base64 data URLs.
 */

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_FILE_SIZE_MB = 15;

export async function compressFile(file: File): Promise<string> {
  // Enforce 15MB maximum file size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File size (${sizeInMb}MB) exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB. Please choose a file under ${MAX_FILE_SIZE_MB}MB.`
    );
  }

  const fileNameLower = file.name.toLowerCase();
  const isDocument =
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileNameLower.endsWith(".pdf") ||
    fileNameLower.endsWith(".doc") ||
    fileNameLower.endsWith(".docx");

  // If document (PDF, DOC, DOCX), read directly as base64 data URL
  if (isDocument) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read document file."));
      reader.readAsDataURL(file);
    });
  }

  // If image, compress via canvas for optimal upload performance and quality
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback to original data URL if 2D context unavailable
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.80);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        // Fallback to original data URL if image rendering fails
        resolve(e.target?.result as string);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}
