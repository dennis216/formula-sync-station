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
 * Extract images from the salvaged PNG ZIP file (Patch ZIP).
 * Parses filename to get the image number (e.g., image70.png -> 70)
 */
export async function parseSalvageZip(file: File): Promise<SalvagedZipImage[]> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    const images: SalvagedZipImage[] = [];
    const allPaths = Object.keys(contents.files);
    
    console.log(`[Patch ZIP] Processing archive: ${file.name}`);
    console.log(`[Patch ZIP] Total files in archive: ${allPaths.length}`);
    
    for (const path of allPaths) {
      const zipEntry = contents.files[path];
      if (!zipEntry || zipEntry.dir) continue;
      
      // Get filename from path (handle both / and \)
      const filename = path.split('/').pop() || path.split('\\').pop() || path;
      const lowerFilename = filename.toLowerCase();
      const extension = lowerFilename.substring(lowerFilename.lastIndexOf('.'));
      
      // Only process displayable image formats
      if (!DISPLAYABLE_EXTENSIONS.includes(extension)) {
        console.log(`[Patch ZIP] Skipping non-image: ${filename}`);
        continue;
      }
      
      // Extract number from filename (e.g., image70.png -> 70)
      const numberMatch = filename.match(/(\d+)/);
      if (!numberMatch) {
        console.warn(`[Patch ZIP] No number in filename: ${filename}, skipping`);
        continue;
      }
      
      const imageNumber = parseInt(numberMatch[1], 10);
      
      try {
        const blob = await zipEntry.async('blob');
        
        // Create proper blob with correct MIME type
        const mimeType = extension === '.png' ? 'image/png' : 
                         extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' :
                         extension === '.gif' ? 'image/gif' :
                         extension === '.webp' ? 'image/webp' : 'image/png';
        
        const typedBlob = new Blob([blob], { type: mimeType });
        const url = URL.createObjectURL(typedBlob);
        
        console.log(`[Patch ZIP] ✅ Extracted: ${filename} -> imageNumber=${imageNumber}, size=${typedBlob.size} bytes`);
        
        images.push({
          imageNumber,
          filename,
          blob: typedBlob,
          url,
        });
      } catch (error) {
        console.error(`[Patch ZIP] Failed to extract ${filename}:`, error);
      }
    }
    
    // Sort by image number
    images.sort((a, b) => a.imageNumber - b.imageNumber);
    
    console.log(`[Patch ZIP] ✅ Total extracted: ${images.length} salvaged images`);
    images.forEach(img => {
      console.log(`[Patch ZIP]   - ${img.filename}: #${img.imageNumber}`);
    });
    
    return images;
  } catch (error) {
    console.error('[Patch ZIP] Failed to parse:', error);
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
