import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedPDFEntry } from '@/types/formula';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

export async function parsePDF(file: File): Promise<ParsedPDFEntry[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const entries: ParsedPDFEntry[] = [];
  const seenPos = new Set<number>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ');

    // Pattern to match "Pos #NUMBER" followed by "imageNUMBER" or similar patterns
    // Updated regex to be more flexible with the patterns
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
      }
      
      // Reset imagePattern for next iteration
      imagePattern.lastIndex = 0;
    }
  }

  // Sort by position number
  entries.sort((a, b) => a.posNumber - b.posNumber);
  
  return entries;
}

// Alternative: Simple sequential extraction
export async function parsePDFSimple(file: File): Promise<ParsedPDFEntry[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + ' ';
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
    }
  }

  entries.sort((a, b) => a.posNumber - b.posNumber);
  
  return entries;
}
