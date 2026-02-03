import JSZip from 'jszip';
import type { ZipImageEntry } from '@/types/formula';

// Supported image formats (browser-compatible)
const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
// Legacy formats that we skip with a warning
const SKIPPED_EXTENSIONS = ['.wmf', '.emf', '.tiff'];

export async function parseZip(file: File): Promise<ZipImageEntry[]> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    const entries: ZipImageEntry[] = [];
    const skippedFiles: string[] = [];
    
    console.log(`[ZIP Parser] Processing archive: ${file.name}`);
    
    const filePromises = Object.entries(contents.files).map(async ([path, zipEntry]) => {
      if (zipEntry.dir) return null;
      
      const filename = path.split('/').pop() || path;
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      
      // Skip unsupported formats with logging
      if (SKIPPED_EXTENSIONS.includes(extension)) {
        skippedFiles.push(filename);
        console.warn(`[ZIP Parser] Skipping unsupported format: ${filename}`);
        return null;
      }
      
      // Only process supported image formats
      if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
        console.log(`[ZIP Parser] Ignoring non-image file: ${filename}`);
        return null;
      }
      
      try {
        const blob = await zipEntry.async('blob');
        const url = URL.createObjectURL(blob);
        
        console.log(`[ZIP Parser] Extracted: ${filename}`);
        
        return {
          filename,
          blob,
          url,
        };
      } catch (error) {
        console.error(`[ZIP Parser] Failed to extract ${filename}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(filePromises);
    
    for (const result of results) {
      if (result) {
        entries.push(result);
      }
    }
    
    if (skippedFiles.length > 0) {
      console.warn(`[ZIP Parser] Skipped ${skippedFiles.length} unsupported files: ${skippedFiles.join(', ')}`);
    }
    
    console.log(`[ZIP Parser] Successfully extracted ${entries.length} images`);
    
    return entries;
  } catch (error) {
    console.error('[ZIP Parser] Failed to parse ZIP:', error);
    return []; // Return empty array instead of throwing
  }
}

export function matchImageToRef(
  imageRef: string,
  zipImages: ZipImageEntry[]
): ZipImageEntry | null {
  // Extract the number from imageRef (e.g., "image15" -> 15)
  const refMatch = imageRef.match(/(\d+)/);
  if (!refMatch) return null;
  
  const refNumber = refMatch[1];
  
  // Try to find matching image by various patterns
  for (const img of zipImages) {
    const filename = img.filename.toLowerCase();
    
    // Pattern 1: image15.png, image15.jpg, etc.
    if (filename.includes(`image${refNumber}.`) || filename.includes(`image${refNumber}_`)) {
      return img;
    }
    
    // Pattern 2: p15.png (common Word export pattern)
    if (filename.match(new RegExp(`^p${refNumber}\\.`, 'i'))) {
      return img;
    }
    
    // Pattern 3: img15.png
    if (filename.match(new RegExp(`^img${refNumber}\\.`, 'i'))) {
      return img;
    }
    
    // Pattern 4: 15.png (just the number)
    if (filename.match(new RegExp(`^${refNumber}\\.`))) {
      return img;
    }
    
    // Pattern 5: Contains the number with word boundaries
    if (filename.match(new RegExp(`[^0-9]${refNumber}[^0-9]`)) || 
        filename.match(new RegExp(`^${refNumber}[^0-9]`)) ||
        filename.match(new RegExp(`[^0-9]${refNumber}$`))) {
      return img;
    }
  }
  
  return null;
}

export function cleanupImageUrls(urls: string[]): void {
  urls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // Ignore errors
    }
  });
}
