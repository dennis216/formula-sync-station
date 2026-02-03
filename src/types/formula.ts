export interface FormulaItem {
  id: string;
  posNumber: number;
  imageRef: string;
  imageName: string | null;
  imageUrl: string | null;
  imageBlob: Blob | null; // Original blob for WMF/EMF files
  // Salvaged image data from PDF
  salvagedImageUrl: string | null;
  salvagedImageBlob: Blob | null;
  status: 'pending' | 'verified' | 'needs-modification' | 'missing' | 'restored';
  latex: string | null;
  aiError: string | null; // Structured AI/format errors (e.g. WMF unsupported)
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

export interface SalvagedPDFImage {
  posNumber: number;
  blob: Blob;
  url: string;
  pageNumber: number;
}
