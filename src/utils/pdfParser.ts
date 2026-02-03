import type { ParsedPDFEntry } from '@/types/formula';

// Dynamically import pdfjs-dist to avoid top-level await issues
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;
  }
  return pdfjsLib;
}

export async function parsePDF(file: File): Promise<ParsedPDFEntry[]> {
  try {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const entries: ParsedPDFEntry[] = [];
    const seenPos = new Set<number>();

    console.log(`[PDF Parser] Processing ${pdf.numPages} pages...`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        if (!text.trim()) {
          console.warn(`[PDF Parser] Page ${pageNum} has no extractable text`);
          continue;
        }

        // Pattern to match "Pos #NUMBER" followed by "imageNUMBER" or similar patterns
        const posPattern = /Pos\s*#?\s*(\d+)/gi;
        const imagePattern = /image\s*(\d+)/gi;
        
        let posMatch;
        while ((posMatch = posPattern.exec(text)) !== null) {
          const posNumber = parseInt(posMatch[1], 10);
          
          // Look for the nearest image reference after this position
          const remainingText = text.slice(posMatch.index);
          const imageMatch = imagePattern.exec(remainingText);
          
          if (imageMatch && !seenPos.has(posNumber)) {
            seenPos.add(posNumber);
            entries.push({
              posNumber,
              imageRef: `image${imageMatch[1]}`,
            });
            console.log(`[PDF Parser] Found: Pos #${posNumber} -> image${imageMatch[1]}`);
          }
          
          // Reset imagePattern for next iteration
          imagePattern.lastIndex = 0;
        }
      } catch (pageError) {
        console.error(`[PDF Parser] Error processing page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }

    // Sort by position number
    entries.sort((a, b) => a.posNumber - b.posNumber);
    console.log(`[PDF Parser] Total entries found: ${entries.length}`);
    
    return entries;
  } catch (error) {
    console.error('[PDF Parser] Failed to parse PDF:', error);
    return []; // Return empty array instead of throwing
  }
}

// Alternative: Simple sequential extraction
export async function parsePDFSimple(file: File): Promise<ParsedPDFEntry[]> {
  try {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    let hasTextContent = false;
    
    console.log(`[PDF Parser Simple] Processing ${pdf.numPages} pages...`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          hasTextContent = true;
        }
        fullText += pageText + ' ';
      } catch (pageError) {
        console.error(`[PDF Parser Simple] Error on page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }

    if (!hasTextContent) {
      console.warn('[PDF Parser Simple] PDF appears to have no extractable text layer');
    }

    const entries: ParsedPDFEntry[] = [];
    
    // Match patterns like "Pos #24" or "Pos 24" with corresponding image references
    const combinedPattern = /Pos\s*#?\s*(\d+)[^]*?image\s*(\d+)/gi;
    
    let match;
    const seenPos = new Set<number>();
    
    while ((match = combinedPattern.exec(fullText)) !== null) {
      const posNumber = parseInt(match[1], 10);
      const imageNumber = match[2];
      
      if (!seenPos.has(posNumber)) {
        seenPos.add(posNumber);
        entries.push({
          posNumber,
          imageRef: `image${imageNumber}`,
        });
        console.log(`[PDF Parser Simple] Found: Pos #${posNumber} -> image${imageNumber}`);
      }
    }

    entries.sort((a, b) => a.posNumber - b.posNumber);
    console.log(`[PDF Parser Simple] Total entries found: ${entries.length}`);
    
    return entries;
  } catch (error) {
    console.error('[PDF Parser Simple] Failed to parse PDF:', error);
    return []; // Return empty array instead of throwing
  }
}
