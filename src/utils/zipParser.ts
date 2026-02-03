import JSZip from 'jszip';
import type { ZipImageEntry } from '@/types/formula';

// Browser-displayable formats
const DISPLAYABLE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
// Legacy formats - extract blob but use placeholder for preview
const LEGACY_EXTENSIONS = ['.wmf', '.emf'];
// All supported formats for extraction
const ALL_SUPPORTED_EXTENSIONS = [...DISPLAYABLE_EXTENSIONS, ...LEGACY_EXTENSIONS];

// Placeholder URL for non-displayable formats
const PLACEHOLDER_URL = '/placeholder.svg';

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
    let wmfCount = 0;
    let displayableCount = 0;
    
    console.log(`[ZIP Parser] Processing archive: ${file.name}`);
    
    const allPaths = Object.keys(contents.files);
    console.log(`[ZIP Parser] Total files in archive: ${allPaths.length}`);
    
    // STRICT: Only process files starting with word/media/ (case-insensitive)
    const mediaFiles = allPaths.filter(path => {
      const lowerPath = path.toLowerCase();
      return lowerPath.startsWith('word/media/') || lowerPath.startsWith('word\\media\\');
    });
    
    console.log(`[ZIP Parser] Found ${mediaFiles.length} files in word/media/ folder`);
    
    // If no word/media/ found, fall back to scanning all paths that CONTAIN word/media
    let pathsToProcess = mediaFiles;
    if (mediaFiles.length === 0) {
      pathsToProcess = allPaths.filter(path => {
        const lowerPath = path.toLowerCase();
        return lowerPath.includes('word/media/') || lowerPath.includes('word\\media\\');
      });
      
      if (pathsToProcess.length === 0) {
        console.warn('[ZIP Parser] No word/media/ folder found, scanning all directories for images');
        pathsToProcess = allPaths;
      }
    }
    
    // Process ALL files - NO LIMITS, NO SLICE
    for (const path of pathsToProcess) {
      const zipEntry = contents.files[path];
      if (!zipEntry || zipEntry.dir) continue;
      
      const filename = path.split('/').pop() || path.split('\\').pop() || path;
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      
      // Skip completely unsupported formats (not image-related)
      if (!ALL_SUPPORTED_EXTENSIONS.includes(extension)) {
        continue;
      }
      
      try {
        const blob = await zipEntry.async('blob');
        const isLegacyFormat = LEGACY_EXTENSIONS.includes(extension);
        
        // For WMF/EMF: preserve blob but use placeholder for preview (memory safe)
        const url = isLegacyFormat ? PLACEHOLDER_URL : URL.createObjectURL(blob);
        
        if (isLegacyFormat) {
          wmfCount++;
        } else {
          displayableCount++;
        }
        
        entries.push({
          filename,
          path,
          blob,
          url,
          isPlaceholder: isLegacyFormat,
        });
      } catch (error) {
        console.error(`[ZIP Parser] Failed to extract ${filename}:`, error);
      }
    }
    
    // Natural sort by filename (image1, image2, ..., image10, image11, ...)
    entries.sort((a, b) => naturalSort(a.filename, b.filename));
    
    console.log(`[ZIP Parser] ✅ Extracted ${entries.length} images total:`);
    console.log(`   - Displayable (PNG/JPG): ${displayableCount}`);
    console.log(`   - Legacy (WMF/EMF with placeholder): ${wmfCount}`);
    
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

export function cleanupImageUrls(images: ZipImageEntry[]): void {
  images.forEach(img => {
    // Only revoke blob URLs, not placeholder URLs
    if (!img.isPlaceholder && img.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(img.url);
      } catch (e) {
        // Ignore errors
      }
    }
  });
}
