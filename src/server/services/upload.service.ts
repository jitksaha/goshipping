import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export class UploadService {
  /**
   * Ensure target folder exists
   */
  private static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Save a binary image buffer
   */
  static async saveImageBuffer(
    buffer: Buffer,
    originalName: string,
    subfolder = 'banners'
  ): Promise<string> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('Image size exceeds 15MB limit.');
    }

    let ext = path.extname(originalName).toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      ext = '.jpg';
    }

    const filename = `banner_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    
    // Primary upload destination
    const targetDir = path.join(process.cwd(), 'public', 'uploads', subfolder);
    this.ensureDir(targetDir);
    const primaryPath = path.join(targetDir, filename);
    fs.writeFileSync(primaryPath, buffer);

    // Sync to dist/client if running production build
    const distTargetDir = path.join(process.cwd(), 'dist', 'client', 'uploads', subfolder);
    if (fs.existsSync(path.join(process.cwd(), 'dist', 'client'))) {
      this.ensureDir(distTargetDir);
      fs.writeFileSync(path.join(distTargetDir, filename), buffer);
    }

    return `/uploads/${subfolder}/${filename}`;
  }

  /**
   * Save a base64 encoded image string (e.g. data:image/png;base64,...)
   */
  static async saveBase64Image(
    base64String: string,
    originalName = 'image.png',
    subfolder = 'banners'
  ): Promise<string> {
    let cleanBase64 = base64String;
    let ext = path.extname(originalName).toLowerCase();

    // Parse Data URL header if present
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      cleanBase64 = matches[2];
      if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg';
      else if (mime === 'image/png') ext = '.png';
      else if (mime === 'image/webp') ext = '.webp';
      else if (mime === 'image/gif') ext = '.gif';
      else if (mime === 'image/svg+xml') ext = '.svg';
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    return this.saveImageBuffer(buffer, `upload${ext}`, subfolder);
  }
}
