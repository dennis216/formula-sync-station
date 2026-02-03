import type { FormulaItem } from '@/types/formula';

export interface ExportData {
  exportedAt: string;
  totalItems: number;
  verifiedCount: number;
  items: ExportItem[];
}

export interface ExportItem {
  posNumber: number;
  imageRef: string;
  status: string;
  latex: string | null;
}

export function exportToJSON(items: FormulaItem[]): string {
  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    totalItems: items.length,
    verifiedCount: items.filter(i => i.status === 'verified').length,
    items: items.map(item => ({
      posNumber: item.posNumber,
      imageRef: item.imageRef,
      status: item.status,
      latex: item.latex,
    })),
  };
  
  return JSON.stringify(exportData, null, 2);
}

export function exportToTXT(items: FormulaItem[]): string {
  const lines: string[] = [
    '==========================================',
    '  FORMULA ARCHIVE STATION - EXPORT',
    `  Generated: ${new Date().toLocaleString()}`,
    '==========================================',
    '',
  ];
  
  for (const item of items) {
    lines.push(`[POS #${item.posNumber}] - ${item.imageRef}`);
    lines.push(`Status: ${item.status.toUpperCase()}`);
    
    if (item.latex) {
      lines.push('LaTeX:');
      lines.push(item.latex);
    } else {
      lines.push('LaTeX: (not converted)');
    }
    
    lines.push('------------------------------------------');
    lines.push('');
  }
  
  lines.push(`Total Items: ${items.length}`);
  lines.push(`Verified: ${items.filter(i => i.status === 'verified').length}`);
  lines.push(`Pending: ${items.filter(i => i.status === 'pending').length}`);
  lines.push(`Needs Modification: ${items.filter(i => i.status === 'needs-modification').length}`);
  lines.push(`Missing: ${items.filter(i => i.status === 'missing').length}`);
  
  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
