import JSZip from 'jszip';
import type { ZipImageEntry } from '@/types/formula';

// Supported image formats (browser-compatible)
const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
// Legacy formats that we skip with a warning
const SKIPPED_EXTENSIONS = ['.wmf', '.emf', '.tiff', '.wdp', '.pcz'];

// Natural sort comparator for filenames (image1 < image2 < image10)
function naturalSort(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export async function parseZip(file: File): Promise<ZipImageEntry[]> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    const entries: ZipImageEntry[] = [];
    const skippedFiles: string[] = [];
    
    console.log(`[ZIP Parser] Processing archive: ${file.name}`);
    
    const allPaths = Object.keys(contents.files);
    console.log(`[ZIP Parser] Total files in archive: ${allPaths.length}`);
    
    // Find all paths containing word/media/ (case-insensitive)
    const mediaFiles = allPaths.filter(path => 
      path.toLowerCase().includes('word/media/') || 
      path.toLowerCase().includes('word\\media\\')
    );
    
    console.log(`[ZIP Parser] Found ${mediaFiles.length} files in word/media/ folder`);
    
    // If no word/media/ found, fall back to scanning all image files
    const pathsToProcess = mediaFiles.length > 0 ? mediaFiles : allPaths;
    
    if (mediaFiles.length === 0) {
      console.warn('[ZIP Parser] No word/media/ folder found, scanning all directories for images');
    }
    
    // Process ALL files without any limits
    const filePromises = pathsToProcess.map(async (path) => {
      const zipEntry = contents.files[path];
      if (!zipEntry || zipEntry.dir) return null;
      
      const filename = path.split('/').pop() || path.split('\\').pop() || path;
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      
      // Skip unsupported formats with logging
      if (SKIPPED_EXTENSIONS.includes(extension)) {
        skippedFiles.push(filename);
        return null;
      }
      
      // Only process supported image formats (PNG/JPG/JPEG)
      if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
        return null;
      }
      
      try {
        const blob = await zipEntry.async('blob');
        const url = URL.createObjectURL(blob);
        
        return {
          filename,
          path,
          blob,
          url,
        };
      } catch (error) {
        console.error(`[ZIP Parser] Failed to extract ${filename}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(filePromises);
    
    // Collect ALL valid results - NO LIMITS
    for (const result of results) {
      if (result) {
        entries.push(result);
      }
    }
    
    if (skippedFiles.length > 0) {
      console.warn(`[ZIP Parser] Skipped ${skippedFiles.length} unsupported formats (WMF/EMF/etc)`);
    }
    
    // Natural sort by filename (image1, image2, ..., image10, image11, ...)
    entries.sort((a, b) => naturalSort(a.filename, b.filename));
    
    console.log(`[ZIP Parser] ✅ Extracted ${entries.length} images total (natural sorted)`);
    
    return entries;
  } catch (error) {
    console.error('[ZIP Parser] Failed to parse ZIP:', error);
    return [];
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
