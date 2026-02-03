import React, { useCallback } from 'react';
import { Upload, FileArchive, CheckCircle2, Puzzle } from 'lucide-react';

interface DualFileUploaderProps {
  onFilesSelected: (baseZipFile: File | null, salvageZipFile: File | null) => void;
  baseZipFile: File | null;
  salvageZipFile: File | null;
  isProcessing: boolean;
  baseImageCount?: number;
  salvagedImageCount?: number;
}

export const DualFileUploader: React.FC<DualFileUploaderProps> = ({
  onFilesSelected,
  baseZipFile,
  salvageZipFile,
  isProcessing,
  baseImageCount,
  salvagedImageCount,
}) => {
  const handleBaseDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.zip')) {
        onFilesSelected(file, salvageZipFile);
      }
    },
    [onFilesSelected, salvageZipFile]
  );

  const handleSalvageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.zip')) {
        onFilesSelected(baseZipFile, file);
      }
    },
    [onFilesSelected, baseZipFile]
  );

  const handleBaseChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      onFilesSelected(file, salvageZipFile);
    },
    [onFilesSelected, salvageZipFile]
  );

  const handleSalvageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      onFilesSelected(baseZipFile, file);
    },
    [onFilesSelected, baseZipFile]
  );

  const preventDefault = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LEFT: Source A (Base) - Original Docx ZIP */}
      <div
        onDrop={handleBaseDrop}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        className={`
          industrial-panel p-6 cursor-pointer transition-all duration-300
          ${baseZipFile ? 'glow-border' : 'hover:border-primary/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className={`p-4 rounded-sm ${baseZipFile ? 'bg-primary/20' : 'bg-muted'}`}>
            <FileArchive className={`w-10 h-10 ${baseZipFile ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">
              Source A: Original Docx ZIP
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {baseZipFile ? baseZipFile.name : 'Drop or click to upload'}
            </p>
            {baseZipFile && baseImageCount !== undefined && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-primary">
                <CheckCircle2 className="w-3 h-3" />
                <span>Original Doc Linked • {baseImageCount} images</span>
              </div>
            )}
          </div>
          
          <input
            type="file"
            accept=".zip"
            onChange={handleBaseChange}
            className="hidden"
            disabled={isProcessing}
          />
          
          {!baseZipFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span>Defines structure & POS order</span>
            </div>
          )}
        </label>
      </div>

      {/* RIGHT: Source B (Patch) - Salvaged PNGs ZIP */}
      <div
        onDrop={handleSalvageDrop}
        onDragOver={preventDefault}
        onDragEnter={preventDefault}
        className={`
          industrial-panel p-6 cursor-pointer transition-all duration-300
          ${salvageZipFile ? 'glow-border' : 'hover:border-accent/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className={`p-4 rounded-sm ${salvageZipFile ? 'bg-accent/20' : 'bg-muted'}`}>
            <Puzzle className={`w-10 h-10 ${salvageZipFile ? 'text-accent' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">
              Source B: Salvaged PNGs ZIP
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {salvageZipFile ? salvageZipFile.name : 'Drop or click to upload'}
            </p>
            {salvageZipFile && salvagedImageCount !== undefined && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-accent">
                <CheckCircle2 className="w-3 h-3" />
                <span>{salvagedImageCount} Images Salvaged</span>
              </div>
            )}
          </div>
          
          <input
            type="file"
            accept=".zip"
            onChange={handleSalvageChange}
            className="hidden"
            disabled={isProcessing}
          />
          
          {!salvageZipFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-4 h-4" />
              <span>PNG conversions from Python script</span>
            </div>
          )}
        </label>
      </div>
    </div>
  );
};
