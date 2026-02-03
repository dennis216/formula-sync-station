import { jsPDF } from 'jspdf';
import type { FormulaItem } from '@/types/formula';

export interface PdfExportProgress {
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: PdfExportProgress) => void;

/**
 * Load image from blob URL and return as base64 data URL
 */
async function loadImageAsBase64(url: string): Promise<{ data: string; width: number; height: number } | null> {
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
          console.warn('[PDF Export] Failed to get canvas context');
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
      } catch (error) {
        console.warn('[PDF Export] Failed to convert image:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      console.warn('[PDF Export] Failed to load image:', url);
      resolve(null);
    };
    
    img.src = url;
  });
}

/**
 * Export all formula items to PDF with auto-pagination
 * Processes ALL items without any limits
 */
export async function exportToPDF(
  items: FormulaItem[],
  onProgress?: ProgressCallback
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const marginLeft = 15;
  const marginRight = 15;
  const marginTop = 20;
  const marginBottom = 20;
  
  const contentWidth = pageWidth - marginLeft - marginRight;
  const maxContentHeight = pageHeight - marginTop - marginBottom;
  
  let currentY = marginTop;
  let pageNumber = 1;
  
  const totalItems = items.length;
  
  // Add header to first page
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Formula Archive Station - Full Export', marginLeft, currentY);
  currentY += 8;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleString()}`, marginLeft, currentY);
  pdf.text(`Total Items: ${totalItems}`, marginLeft + 80, currentY);
  currentY += 10;
  
  // Draw separator line
  pdf.setDrawColor(180, 180, 180);
  pdf.line(marginLeft, currentY, pageWidth - marginRight, currentY);
  currentY += 10;

  // Process ALL items - no limits
  for (let i = 0; i < totalItems; i++) {
    const item = items[i];
    
    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: totalItems,
        message: `Exporting item ${i + 1} of ${totalItems}...`,
      });
    }
    
    // Small delay to prevent browser freeze on large datasets
    if (i > 0 && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Calculate space needed for this item
    const labelHeight = 8;
    const spacingAfterItem = 10;
    let imageHeight = 40; // Default height
    let imageWidth = contentWidth * 0.8;
    
    let imageData: { data: string; width: number; height: number } | null = null;
    
    // Load image if available
    if (item.imageUrl) {
      imageData = await loadImageAsBase64(item.imageUrl);
      
      if (imageData) {
        // Calculate scaled dimensions to fit content width
        const aspectRatio = imageData.height / imageData.width;
        imageWidth = Math.min(contentWidth * 0.8, 120); // Max 120mm width
        imageHeight = imageWidth * aspectRatio;
        
        // Cap height to prevent single image from exceeding page
        if (imageHeight > maxContentHeight - labelHeight - 20) {
          imageHeight = maxContentHeight - labelHeight - 20;
          imageWidth = imageHeight / aspectRatio;
        }
      }
    }
    
    const totalItemHeight = labelHeight + imageHeight + spacingAfterItem;
    
    // Check if we need a new page
    if (currentY + totalItemHeight > pageHeight - marginBottom) {
      pdf.addPage();
      pageNumber++;
      currentY = marginTop;
      
      // Add page header
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Formula Archive - Page ${pageNumber}`, marginLeft, currentY - 5);
      pdf.setTextColor(0, 0, 0);
      currentY += 5;
    }
    
    // Draw item label: POS #X (filename)
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 100, 150); // Cyan-ish color for emphasis
    
    const filename = item.imageName || item.imageRef || 'Unknown';
    const label = `POS #${item.posNumber} (${filename})`;
    pdf.text(label, marginLeft, currentY);
    currentY += labelHeight;
    
    pdf.setTextColor(0, 0, 0);
    
    // Draw image or placeholder
    if (imageData) {
      try {
        const xOffset = marginLeft + (contentWidth - imageWidth) / 2;
        pdf.addImage(imageData.data, 'PNG', xOffset, currentY, imageWidth, imageHeight);
        currentY += imageHeight;
      } catch (error) {
        console.warn(`[PDF Export] Failed to add image for POS #${item.posNumber}:`, error);
        // Draw placeholder
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(150, 150, 150);
        pdf.text('[Image could not be loaded]', marginLeft, currentY + 5);
        pdf.setTextColor(0, 0, 0);
        currentY += 15;
      }
    } else if (item.imageUrl === '/placeholder.svg') {
      // WMF/EMF format - cannot be displayed in PDF
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(180, 100, 50);
      pdf.text('[WMF/EMF Format - Cannot display directly]', marginLeft, currentY + 5);
      
      // If LaTeX is available, show it instead
      if (item.latex && !item.latex.startsWith('ERROR:')) {
        pdf.setTextColor(60, 60, 60);
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(8);
        const latexPreview = item.latex.length > 80 ? item.latex.substring(0, 80) + '...' : item.latex;
        pdf.text(`LaTeX: ${latexPreview}`, marginLeft, currentY + 12);
        currentY += 20;
      } else {
        pdf.text('[Use AI Recognition to get LaTeX]', marginLeft + 100, currentY + 5);
        currentY += 15;
      }
      pdf.setTextColor(0, 0, 0);
    } else {
      // No image available - draw placeholder
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(150, 150, 150);
      const statusText = item.status === 'missing' ? '[Image Missing]' : '[No image URL]';
      pdf.text(statusText, marginLeft, currentY + 5);
      pdf.setTextColor(0, 0, 0);
      currentY += 15;
    }
    
    // Add status badge
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const statusColor = getStatusColor(item.status);
    pdf.setTextColor(statusColor.r, statusColor.g, statusColor.b);
    pdf.text(`Status: ${item.status.toUpperCase()}`, marginLeft, currentY + 3);
    pdf.setTextColor(0, 0, 0);
    
    currentY += spacingAfterItem;
    
    // Draw subtle separator
    pdf.setDrawColor(220, 220, 220);
    pdf.line(marginLeft, currentY - 3, marginLeft + 60, currentY - 3);
  }
  
  // Final progress update
  if (onProgress) {
    onProgress({
      current: totalItems,
      total: totalItems,
      message: 'Saving PDF file...',
    });
  }
  
  // Save the PDF
  pdf.save('Full_Formula_Archive.pdf');
}

function getStatusColor(status: string): { r: number; g: number; b: number } {
  switch (status) {
    case 'verified':
      return { r: 34, g: 139, b: 34 }; // Green
    case 'pending':
      return { r: 200, g: 150, b: 0 }; // Yellow/Orange
    case 'needs-modification':
      return { r: 200, g: 100, b: 0 }; // Orange
    case 'missing':
      return { r: 180, g: 50, b: 50 }; // Red
    default:
      return { r: 100, g: 100, b: 100 }; // Gray
  }
}
