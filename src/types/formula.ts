export interface FormulaItem {
  id: string;
  posNumber: number;
  imageRef: string;
  imageName: string | null;
  imageUrl: string | null;
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
  blob: Blob;
  url: string;
}
