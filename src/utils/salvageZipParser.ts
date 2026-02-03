import JSZip from 'jszip';

export interface SalvagedZipImage {
  /** The number extracted from the filename (e.g., image70.png -> 70) */
  imageNumber: number;
  filename: string;
  blob: Blob;
  url: string;
}

// Displayable image extensions
const DISPLAYABLE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

/**
 * Extract images from the salvaged PNG ZIP file.
 * Parses filename to get the image number (e.g., image70.png -> 70)
 */
export async function parseSalvageZip(file: File): Promise<SalvagedZipImage[]> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    const images: SalvagedZipImage[] = [];
    const allPaths = Object.keys(contents.files);
    
    console.log(`[Salvage ZIP] Processing archive: ${file.name}`);
    console.log(`[Salvage ZIP] Total files: ${allPaths.length}`);
    
    for (const path of allPaths) {
      const zipEntry = contents.files[path];
      if (!zipEntry || zipEntry.dir) continue;
      
      const filename = path.split('/').pop() || path.split('\\').pop() || path;
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      
      // Only process displayable image formats
      if (!DISPLAYABLE_EXTENSIONS.includes(extension)) {
        continue;
      }
      
      // Extract number from filename (e.g., image70.png -> 70)
      const numberMatch = filename.match(/(\d+)/);
      if (!numberMatch) {
        console.warn(`[Salvage ZIP] No number in filename: ${filename}, skipping`);
        continue;
      }
      
      const imageNumber = parseInt(numberMatch[1], 10);
      
      try {
        const blob = await zipEntry.async('blob');
        const url = URL.createObjectURL(blob);
        
        images.push({
          imageNumber,
          filename,
          blob,
          url,
        });
      } catch (error) {
        console.error(`[Salvage ZIP] Failed to extract ${filename}:`, error);
      }
    }
    
    // Sort by image number
    images.sort((a, b) => a.imageNumber - b.imageNumber);
    
    console.log(`[Salvage ZIP] ✅ Extracted ${images.length} salvaged images`);
    
    return images;
  } catch (error) {
    console.error('[Salvage ZIP] Failed to parse:', error);
    return [];
  }
}

/**
 * Clean up salvaged image URLs
 */
export function cleanupSalvagedZipUrls(images: SalvagedZipImage[]): void {
  images.forEach((img) => {
    if (img.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(img.url);
      } catch (e) {
        // Ignore errors
      }
    }
  });
}
