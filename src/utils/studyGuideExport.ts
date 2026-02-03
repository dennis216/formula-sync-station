import { jsPDF } from 'jspdf';
import type { FormulaItem } from '@/types/formula';
import type { DocumentElement, ParsedDocument } from './docxParser';

export interface StudyGuideProgress {
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: StudyGuideProgress) => void;

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 25;
const MARGIN_BOTTOM = 25;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const MAX_CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

/**
 * Load image from blob URL and return as base64 data URL
 */
async function loadImageAsBase64(
  url: string
): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');

        resolve({
          data: dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Wrap text to fit within a given width
 */
function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push(''); // Empty line for paragraph break
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = pdf.getTextWidth(testLine);

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Export a fully reconstructed study guide PDF with text + images + LaTeX
 */
export async function exportStudyGuide(
  document: ParsedDocument,
  items: FormulaItem[],
  onProgress?: ProgressCallback
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let currentY = MARGIN_TOP;
  let pageNumber = 1;

  // Build a map of imageNumber -> FormulaItem for quick lookup
  const itemMap = new Map<number, FormulaItem>();
  for (const item of items) {
    const numMatch = item.imageRef?.match(/(\d+)/);
    if (numMatch) {
      itemMap.set(parseInt(numMatch[1], 10), item);
    }
  }

  const totalElements = document.elements.length;
  let processedElements = 0;

  // Add title page / header
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  const title = document.title || 'Repaired Study Guide';
  pdf.text(title, MARGIN_LEFT, currentY);
  currentY += 12;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, MARGIN_LEFT, currentY);
  pdf.text(
    `${document.imageCount} formulas • ${document.textBlockCount} text blocks`,
    MARGIN_LEFT + 70,
    currentY
  );
  currentY += 8;

  // Separator
  pdf.setDrawColor(200, 200, 200);
  pdf.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 15;

  pdf.setTextColor(0, 0, 0);

  // Helper to add a new page
  const addNewPage = () => {
    pdf.addPage();
    pageNumber++;
    currentY = MARGIN_TOP;

    // Page header
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(`${title} — Page ${pageNumber}`, MARGIN_LEFT, 10);
    pdf.setTextColor(0, 0, 0);
  };

  // Helper to check if we need a new page
  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      addNewPage();
    }
  };

  // Process each element in document order
  for (const element of document.elements) {
    processedElements++;

    if (onProgress) {
      onProgress({
        current: processedElements,
        total: totalElements,
        message: `Processing ${element.type}...`,
      });
    }

    // Small delay every 5 elements to prevent UI freeze
    if (processedElements % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    switch (element.type) {
      case 'heading': {
        const fontSize = element.level === 1 ? 18 : element.level === 2 ? 14 : 12;
        const lineHeight = fontSize * 0.5;

        ensureSpace(lineHeight + 10);

        // Add some spacing before headings
        currentY += 5;

        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
        pdf.text(element.content || '', MARGIN_LEFT, currentY);
        currentY += lineHeight + 5;

        break;
      }

      case 'text': {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const lines = wrapText(pdf, element.content || '', CONTENT_WIDTH);
        const lineHeight = 5;
        const blockHeight = lines.length * lineHeight;

        ensureSpace(Math.min(blockHeight, 50)); // At least check for first few lines

        for (const line of lines) {
          if (currentY + lineHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
            addNewPage();
          }

          if (line.trim()) {
            pdf.text(line, MARGIN_LEFT, currentY);
          }
          currentY += lineHeight;
        }

        currentY += 3; // Paragraph spacing
        break;
      }

      case 'image': {
        if (!element.imageNumber) break;

        const item = itemMap.get(element.imageNumber);
        if (!item) {
          console.warn(`[Study Guide] No item found for image #${element.imageNumber}`);
          break;
        }

        // Prioritize salvaged image
        const imageUrl = item.salvagedImageUrl || item.imageUrl;
        let imageData: { data: string; width: number; height: number } | null = null;

        if (imageUrl && imageUrl !== '/placeholder.svg') {
          imageData = await loadImageAsBase64(imageUrl);
        }

        // Calculate image dimensions
        let imgWidth = CONTENT_WIDTH * 0.7;
        let imgHeight = 30;

        if (imageData) {
          const aspectRatio = imageData.height / imageData.width;
          imgHeight = imgWidth * aspectRatio;

          // Cap to reasonable size
          if (imgHeight > MAX_CONTENT_HEIGHT * 0.4) {
            imgHeight = MAX_CONTENT_HEIGHT * 0.4;
            imgWidth = imgHeight / aspectRatio;
          }
        }

        // Calculate total space needed: image + optional LaTeX + spacing
        const hasLatex = item.latex && !item.latex.startsWith('ERROR:');
        const latexHeight = hasLatex ? 20 : 0;
        const totalNeeded = imgHeight + latexHeight + 15;

        ensureSpace(totalNeeded);

        // Center the image
        const xOffset = MARGIN_LEFT + (CONTENT_WIDTH - imgWidth) / 2;

        if (imageData) {
          try {
            pdf.addImage(imageData.data, 'PNG', xOffset, currentY, imgWidth, imgHeight);
          } catch {
            // Fallback: show placeholder text
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(150, 150, 150);
            pdf.text('[Image could not be rendered]', xOffset, currentY + 10);
            pdf.setTextColor(0, 0, 0);
            imgHeight = 15;
          }
        } else {
          // No image available
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(180, 100, 50);
          const msg =
            item.status === 'restored'
              ? '[Restored image - rendering failed]'
              : '[Original WMF - needs patch ZIP]';
          pdf.text(msg, xOffset, currentY + 10);
          pdf.setTextColor(0, 0, 0);
          imgHeight = 15;
        }

        currentY += imgHeight + 3;

        // Add LaTeX below the image if available
        if (hasLatex) {
          pdf.setFontSize(9);
          pdf.setFont('courier', 'normal');
          pdf.setTextColor(60, 60, 100);

          // Wrap LaTeX code
          const latexLines = wrapText(pdf, `LaTeX: ${item.latex}`, CONTENT_WIDTH);
          for (const line of latexLines.slice(0, 3)) {
            // Max 3 lines
            pdf.text(line, MARGIN_LEFT, currentY);
            currentY += 4;
          }
          if (latexLines.length > 3) {
            pdf.text('...', MARGIN_LEFT, currentY);
            currentY += 4;
          }

          pdf.setTextColor(0, 0, 0);
        }

        currentY += 8; // Spacing after formula block
        break;
      }

      case 'break': {
        currentY += 10;
        break;
      }
    }
  }

  // Final progress
  if (onProgress) {
    onProgress({
      current: totalElements,
      total: totalElements,
      message: 'Saving PDF...',
    });
  }

  // Save the PDF
  pdf.save('Repaired_Study_Guide.pdf');
}
