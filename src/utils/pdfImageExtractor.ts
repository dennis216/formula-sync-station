import type { SalvagedPDFImage } from '@/types/formula';

// Dynamically import pdfjs-dist to avoid top-level await issues
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;
  }
  return pdfjsLib;
}

/**
 * Extract images from a salvaged PDF.
 * The PDF contains POS #XX labels followed by clear images.
 * We parse text to find POS numbers and render images from the PDF pages.
 */
export async function extractSalvagedImages(file: File): Promise<SalvagedPDFImage[]> {
  const images: SalvagedPDFImage[] = [];
  
  try {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    console.log(`[PDF Image Extractor] Processing ${pdf.numPages} pages...`);
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        
        // Extract text to find POS numbers
        const textContent = await page.getTextContent();
        const textItems = textContent.items as Array<{ str: string; transform?: number[] }>;
        const pageText = textItems.map((item) => item.str).join(' ');
        
        // Find all POS #XX patterns on this page
        const posPattern = /Pos\s*#?\s*(\d+)/gi;
        const posMatches: number[] = [];
        let match;
        
        while ((match = posPattern.exec(pageText)) !== null) {
          const posNum = parseInt(match[1], 10);
          if (!isNaN(posNum) && !posMatches.includes(posNum)) {
            posMatches.push(posNum);
          }
        }
        
        if (posMatches.length === 0) {
          console.log(`[PDF Image Extractor] Page ${pageNum}: No POS numbers found, treating as single image`);
          // Fallback: render entire page as image with sequential POS
          const imageData = await renderPageAsImage(page);
          if (imageData) {
            images.push({
              posNumber: pageNum, // Use page number as fallback POS
              blob: imageData.blob,
              url: imageData.url,
              pageNumber: pageNum,
            });
          }
          continue;
        }
        
        console.log(`[PDF Image Extractor] Page ${pageNum}: Found POS numbers: ${posMatches.join(', ')}`);
        
        // Render the page as a single high-quality image
        const imageData = await renderPageAsImage(page, 2.0); // 2x scale for quality
        
        if (imageData && posMatches.length === 1) {
          // Single POS on page - use the full page image
          images.push({
            posNumber: posMatches[0],
            blob: imageData.blob,
            url: imageData.url,
            pageNumber: pageNum,
          });
        } else if (imageData && posMatches.length > 1) {
          // Multiple POS on same page - we'll try to split the image
          // For now, assign to first POS and note others
          const splitImages = await splitPageByPosCount(imageData.canvas, posMatches.length);
          
          for (let i = 0; i < posMatches.length && i < splitImages.length; i++) {
            images.push({
              posNumber: posMatches[i],
              blob: splitImages[i].blob,
              url: splitImages[i].url,
              pageNumber: pageNum,
            });
          }
        }
      } catch (pageError) {
        console.error(`[PDF Image Extractor] Error on page ${pageNum}:`, pageError);
      }
    }
    
    // Sort by POS number
    images.sort((a, b) => a.posNumber - b.posNumber);
    console.log(`[PDF Image Extractor] ✅ Extracted ${images.length} images from PDF`);
    
    return images;
  } catch (error) {
    console.error('[PDF Image Extractor] Failed:', error);
    return [];
  }
}

/**
 * Render a PDF page to a canvas and return as blob
 */
async function renderPageAsImage(
  page: any,
  scale: number = 1.5
): Promise<{ blob: Blob; url: string; canvas: HTMLCanvasElement } | null> {
  try {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.warn('[PDF Image Extractor] Failed to get canvas context');
      return null;
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // White background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    });
    
    const url = URL.createObjectURL(blob);
    
    return { blob, url, canvas };
  } catch (error) {
    console.error('[PDF Image Extractor] Render error:', error);
    return null;
  }
}

/**
 * Split a page canvas into equal vertical sections based on POS count
 */
async function splitPageByPosCount(
  canvas: HTMLCanvasElement,
  count: number
): Promise<Array<{ blob: Blob; url: string }>> {
  const results: Array<{ blob: Blob; url: string }> = [];
  const sectionHeight = Math.floor(canvas.height / count);
  
  for (let i = 0; i < count; i++) {
    try {
      const sectionCanvas = document.createElement('canvas');
      sectionCanvas.width = canvas.width;
      sectionCanvas.height = sectionHeight;
      
      const ctx = sectionCanvas.getContext('2d');
      if (!ctx) continue;
      
      // Copy the section
      ctx.drawImage(
        canvas,
        0, i * sectionHeight, canvas.width, sectionHeight,
        0, 0, canvas.width, sectionHeight
      );
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        sectionCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create section blob'));
        }, 'image/png');
      });
      
      const url = URL.createObjectURL(blob);
      results.push({ blob, url });
    } catch (error) {
      console.error(`[PDF Image Extractor] Failed to split section ${i}:`, error);
    }
  }
  
  return results;
}

/**
 * Clean up salvaged image URLs
 */
export function cleanupSalvagedUrls(images: SalvagedPDFImage[]): void {
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
