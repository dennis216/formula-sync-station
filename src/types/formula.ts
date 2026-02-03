export interface FormulaItem {
  id: string;
  posNumber: number;
  imageRef: string;
  imageName: string | null;
  imageUrl: string | null;
  imageBlob: Blob | null; // Original blob for WMF/EMF files
  status: 'pending' | 'verified' | 'needs-modification' | 'missing';
  latex: string | null;
  isProcessing: boolean;
}

export interface ParsedPDFEntry {
  posNumber: number;
  imageRef: string;
}

export interface ZipImageEntry {
  filename: string;
  path: string;
  blob: Blob;
  url: string;
  isPlaceholder: boolean; // true if WMF/EMF (can't preview but blob is preserved)
}
