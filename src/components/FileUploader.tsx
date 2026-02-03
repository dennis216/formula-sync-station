import React, { useCallback } from 'react';
import { Upload, FileArchive, FileText } from 'lucide-react';

interface FileUploaderProps {
  onFilesSelected: (zipFile: File | null, pdfFile: File | null) => void;
  zipFile: File | null;
  pdfFile: File | null;
  isProcessing: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  zipFile,
  pdfFile,
  isProcessing,
}) => {
  const handleZipDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.zip')) {
        onFilesSelected(file, pdfFile);
      }
    },
    [onFilesSelected, pdfFile]
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
      onFilesSelected(file, pdfFile);
    },
    [onFilesSelected, pdfFile]
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
      {/* ZIP Upload */}
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
              Media Archive (ZIP)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {zipFile ? zipFile.name : 'Drop or click to upload'}
            </p>
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
              <span>Extracted Word images</span>
            </div>
          )}
        </label>
      </div>

      {/* PDF Upload */}
      <div
        onDrop={handlePdfDrop}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        className={`
          industrial-panel p-6 cursor-pointer transition-all duration-300
          ${pdfFile ? 'glow-border' : 'hover:border-primary/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className={`p-4 rounded-sm ${pdfFile ? 'bg-primary/20' : 'bg-muted'}`}>
            <FileText className={`w-10 h-10 ${pdfFile ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">
              Position Index (PDF)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {pdfFile ? pdfFile.name : 'Drop or click to upload'}
            </p>
          </div>
          
          <input
            type="file"
            accept=".pdf"
            onChange={handlePdfChange}
            className="hidden"
            disabled={isProcessing}
          />
          
          {!pdfFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span>Document with POS numbers</span>
            </div>
          )}
        </label>
      </div>
    </div>
  );
};
