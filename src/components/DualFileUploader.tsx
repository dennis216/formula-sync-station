import React, { useCallback } from 'react';
import { Upload, FileArchive, FileImage, CheckCircle2 } from 'lucide-react';

interface DualFileUploaderProps {
  onFilesSelected: (zipFile: File | null, salvagePdfFile: File | null) => void;
  zipFile: File | null;
  salvagePdfFile: File | null;
  isProcessing: boolean;
  zipImageCount?: number;
  salvagedImageCount?: number;
}

export const DualFileUploader: React.FC<DualFileUploaderProps> = ({
  onFilesSelected,
  zipFile,
  salvagePdfFile,
  isProcessing,
  zipImageCount,
  salvagedImageCount,
}) => {
  const handleZipDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.zip')) {
        onFilesSelected(file, salvagePdfFile);
      }
    },
    [onFilesSelected, salvagePdfFile]
  );

  const handlePdfDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.pdf')) {
        onFilesSelected(zipFile, file);
      }
    },
    [onFilesSelected, zipFile]
  );

  const handleZipChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      onFilesSelected(file, salvagePdfFile);
    },
    [onFilesSelected, salvagePdfFile]
  );

  const handlePdfChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      onFilesSelected(zipFile, file);
    },
    [onFilesSelected, zipFile]
  );

  const preventDefault = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LEFT: Original ZIP Upload */}
      <div
        onDrop={handleZipDrop}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        className={`
          industrial-panel p-6 cursor-pointer transition-all duration-300
          ${zipFile ? 'glow-border' : 'hover:border-primary/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className={`p-4 rounded-sm ${zipFile ? 'bg-primary/20' : 'bg-muted'}`}>
            <FileArchive className={`w-10 h-10 ${zipFile ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">
              Original Source (ZIP)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {zipFile ? zipFile.name : 'Drop or click to upload'}
            </p>
            {zipFile && zipImageCount !== undefined && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-primary">
                <CheckCircle2 className="w-3 h-3" />
                <span>Original Doc Linked • {zipImageCount} images</span>
              </div>
            )}
          </div>
          
          <input
            type="file"
            accept=".zip"
            onChange={handleZipChange}
            className="hidden"
            disabled={isProcessing}
          />
          
          {!zipFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span>Extracted Word archive (.docx → .zip)</span>
            </div>
          )}
        </label>
      </div>

      {/* RIGHT: Salvaged Images PDF Upload */}
      <div
        onDrop={handlePdfDrop}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        className={`
          industrial-panel p-6 cursor-pointer transition-all duration-300
          ${salvagePdfFile ? 'glow-border' : 'hover:border-accent/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className={`p-4 rounded-sm ${salvagePdfFile ? 'bg-accent/20' : 'bg-muted'}`}>
            <FileImage className={`w-10 h-10 ${salvagePdfFile ? 'text-accent' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">
              Salvaged Images (PDF)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {salvagePdfFile ? salvagePdfFile.name : 'Drop or click to upload'}
            </p>
            {salvagePdfFile && salvagedImageCount !== undefined && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-accent">
                <CheckCircle2 className="w-3 h-3" />
                <span>{salvagedImageCount} Images Salvaged</span>
              </div>
            )}
          </div>
          
          <input
            type="file"
            accept=".pdf"
            onChange={handlePdfChange}
            className="hidden"
            disabled={isProcessing}
          />
          
          {!salvagePdfFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span>Python-extracted clear images with POS #</span>
            </div>
          )}
        </label>
      </div>
    </div>
  );
};
