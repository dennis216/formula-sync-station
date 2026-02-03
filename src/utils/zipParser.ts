import JSZip from 'jszip';
import type { ZipImageEntry } from '@/types/formula';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.emf', '.wmf'];

export async function parseZip(file: File): Promise<ZipImageEntry[]> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  
  const entries: ZipImageEntry[] = [];
  
  const filePromises = Object.entries(contents.files).map(async ([path, zipEntry]) => {
    if (zipEntry.dir) return null;
    
    const filename = path.split('/').pop() || path;
    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    
    if (!IMAGE_EXTENSIONS.includes(extension)) return null;
    
    try {
      const blob = await zipEntry.async('blob');
      const url = URL.createObjectURL(blob);
      
      return {
        filename,
        blob,
        url,
      };
    } catch (error) {
      console.error(`Failed to extract ${filename}:`, error);
      return null;
    }
  });
  
  const results = await Promise.all(filePromises);
  
  for (const result of results) {
    if (result) {
      entries.push(result);
    }
  }
  
  return entries;
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
