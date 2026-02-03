import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { DualFileUploader } from '@/components/DualFileUploader';
import { FormulaList } from '@/components/FormulaList';
import { ExportPanel } from '@/components/ExportPanel';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { useFormulaItems } from '@/hooks/useFormulaItems';
import { parseZip, cleanupImageUrls } from '@/utils/zipParser';
import { parseSalvageZip, cleanupSalvagedZipUrls } from '@/utils/salvageZipParser';
import { exportToJSON, exportToTXT, downloadFile } from '@/utils/exportUtils';
import { exportToPDF, type PdfExportProgress } from '@/utils/pdfExport';
import type { ZipImageEntry, SalvagedZipImage } from '@/types/formula';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [baseZipFile, setBaseZipFile] = useState<File | null>(null);
  const [salvageZipFile, setSalvageZipFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingProgress, setProcessingProgress] = useState<number | undefined>();
  const [baseZipImages, setBaseZipImages] = useState<ZipImageEntry[]>([]);
  const [salvagedImages, setSalvagedImages] = useState<SalvagedZipImage[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);

  const {
    items,
    filteredItems,
    filterStatus,
    stats,
    setFilterStatus,
    buildItems,
    applySalvagedImages,
    updateItemStatus,
    updateItemLatex,
    updateItemAiError,
    setItemProcessing,
    clearItems,
  } = useFormulaItems();

  const handleFilesSelected = useCallback(
    (base: File | null, salvage: File | null) => {
      setBaseZipFile(base);
      setSalvageZipFile(salvage);
    },
    []
  );

  const handleProcess = async () => {
    if (!baseZipFile) {
      toast.error('Please upload the original ZIP file');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Clean up previous URLs
      cleanupImageUrls(baseZipImages);
      cleanupSalvagedZipUrls(salvagedImages);

      // Step 1: Parse base ZIP (determines POS order and original images)
      setProcessingMessage('Extracting original images from archive...');
      setProcessingProgress(15);
      
      let images: ZipImageEntry[] = [];
      try {
        images = await parseZip(baseZipFile);
        setBaseZipImages(images);
      } catch (zipError) {
        const errorMsg = zipError instanceof Error ? zipError.message : 'Unknown ZIP error';
        console.error('[ZIP] Parse failed:', zipError);
        toast.error(`ZIP extraction failed: ${errorMsg}`);
        setIsProcessing(false);
        return;
      }
      
      if (images.length === 0) {
        toast.error('No images found in ZIP. Please ensure the archive contains word/media/ folder.');
        setIsProcessing(false);
        return;
      }

      console.log(`[Process] Found ${images.length} images in base ZIP`);

      // Step 2: Build initial items from ZIP (POS order based on filenames)
      setProcessingMessage('Building formula list from original document...');
      setProcessingProgress(35);
      
      // Generate POS entries from ZIP images (natural sorted order)
      const pdfEntries = images.map((img, index) => ({
        posNumber: index + 1,
        imageRef: img.filename.replace(/\.[^.]+$/, ''),
      }));
      
      buildItems(pdfEntries, images, true);
      console.log(`[Process] Built ${pdfEntries.length} items from base ZIP`);

      // Step 3: If salvage ZIP is provided, extract and match images by filename number
      let extractedSalvaged: SalvagedZipImage[] = [];
      
      if (salvageZipFile) {
        setProcessingMessage('Extracting salvaged PNGs from patch ZIP...');
        setProcessingProgress(55);
        
        try {
          extractedSalvaged = await parseSalvageZip(salvageZipFile);
          setSalvagedImages(extractedSalvaged);
          console.log(`[Process] Extracted ${extractedSalvaged.length} salvaged images from patch ZIP`);
          
          if (extractedSalvaged.length > 0) {
            setProcessingMessage('Matching and stitching images...');
            setProcessingProgress(75);
            applySalvagedImages(extractedSalvaged);
            
            toast.success(`${extractedSalvaged.length} Images Salvaged and stitched!`);
          } else {
            toast.warning('No PNG images found in salvage ZIP.');
          }
        } catch (salvageError) {
          console.error('[Salvage ZIP] Extraction failed:', salvageError);
          toast.warning('Could not extract images from salvage ZIP');
        }
      }

      setProcessingProgress(100);
      setHasProcessed(true);
      
      const restoredCount = extractedSalvaged.length;
      const totalCount = pdfEntries.length;
      
      toast.success(
        `Loaded ${totalCount} positions • ${restoredCount} restored from PDF`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Processing error:', error);
      toast.error(`Failed to process files: ${errorMsg}`, { duration: 5000 });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(undefined);
    }
  };

  const handleReset = () => {
    cleanupImageUrls(baseZipImages);
    cleanupSalvagedZipUrls(salvagedImages);
    setBaseZipFile(null);
    setSalvageZipFile(null);
    setBaseZipImages([]);
    setSalvagedImages([]);
    clearItems();
    setHasProcessed(false);
    toast.info('Workspace cleared');
  };

  const handleAiRecognize = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) {
      toast.error('Item not found');
      return;
    }

    // PRIORITY: Use salvaged (patched) image first, then original
    const imageBlob = item.salvagedImageBlob || item.imageBlob;
    const imageUrl = item.salvagedImageUrl || item.imageUrl;
    
    console.log(`[AI] Processing POS #${item.posNumber}:`);
    console.log(`[AI]   salvagedImageBlob: ${item.salvagedImageBlob ? `${item.salvagedImageBlob.size} bytes` : 'null'}`);
    console.log(`[AI]   salvagedImageUrl: ${item.salvagedImageUrl || 'null'}`);
    console.log(`[AI]   originalImageBlob: ${item.imageBlob ? `${item.imageBlob.size} bytes` : 'null'}`);
    console.log(`[AI]   Using blob: ${imageBlob ? `${imageBlob.size} bytes, type=${imageBlob.type}` : 'null'}`);
    
    // Must have blob data to proceed
    if (!imageBlob) {
      toast.error('No image data available - cannot process');
      return;
    }

    setItemProcessing(id, true);
    updateItemAiError(id, null);

    try {
      // Use the blob directly (prioritizes salvaged PNG over original WMF)
      const blob = imageBlob;
      console.log(`[AI] Sending to Gemini: ${blob.size} bytes, type=${blob.type}`);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const imageBase64 = await base64Promise;
      console.log(`[AI] Base64 length: ${imageBase64.length} chars`);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('recognize-formula', {
        body: { imageBase64 },
      });

      if (error) {
        console.error('[AI] Supabase invoke error:', error);
        toast.error(`AI recognition failed: ${error.message || 'Network error'}`);
        return;
      }

      // Handle UNSUPPORTED_FORMAT error (WMF/EMF files)
      if (data?.error === 'UNSUPPORTED_FORMAT') {
        const msg = data.message || `${data.format || 'File'} format requires conversion to PNG`;
        updateItemAiError(id, msg);
        updateItemStatus(id, 'needs-modification');
        toast.warning(`POS #${item.posNumber}: ${msg}`);
        return;
      }

      // Handle other structured errors
      if (data?.error) {
        const errText = String(data.error);
        // Legacy format check for backwards compatibility
        const unsupportedMatch = errText.match(/\[UNSUPPORTED_FORMAT:\s*([A-Z0-9+_-]+)\]/i);
        if (unsupportedMatch) {
          const fmt = unsupportedMatch[1].toUpperCase();
          const msg = `${fmt} format requires manual conversion or OCR`;
          updateItemAiError(id, msg);
          updateItemStatus(id, 'needs-modification');
          toast.warning(`POS #${item.posNumber}: ${msg}`);
          return;
        }

        // Generic AI error
        toast.error(`POS #${item.posNumber}: ${errText}`);
        updateItemAiError(id, errText);
        return;
      }

      const latex = String(data?.latex ?? '');
      if (!latex) {
        toast.error(`POS #${item.posNumber}: No LaTeX returned`);
        return;
      }
      
      if (latex.startsWith('ERROR:')) {
        toast.error(`POS #${item.posNumber}: ${latex}`);
      } else {
        updateItemLatex(id, latex);
        toast.success(`POS #${item.posNumber} converted to LaTeX`);
      }
    } catch (error) {
      console.error('AI recognition error:', error);
      toast.error(`AI recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setItemProcessing(id, false);
    }
  };

  const handleExportJSON = () => {
    const json = exportToJSON(items);
    downloadFile(json, 'formula-export.json', 'application/json');
    toast.success('Exported as JSON');
  };

  const handleExportTXT = () => {
    const txt = exportToTXT(items);
    downloadFile(txt, 'formula-export.txt', 'text/plain');
    toast.success('Exported as TXT');
  };

  const handleExportPDF = async () => {
    if (items.length === 0) {
      toast.error('No items to export');
      return;
    }

    setIsProcessing(true);
    
    try {
      await exportToPDF(items, (progress: PdfExportProgress) => {
        setProcessingMessage(`Exporting ${progress.current}/${progress.total}...`);
        setProcessingProgress(Math.round((progress.current / progress.total) * 100));
      });
      
      toast.success(`PDF export complete! ${items.length} items exported.`);
    } catch (error) {
      console.error('[PDF Export] Error:', error);
      toast.error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(undefined);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />

      <main className="container py-6 space-y-6">
        {/* Upload Section */}
        <section>
          <DualFileUploader
            baseZipFile={baseZipFile}
            salvageZipFile={salvageZipFile}
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
            baseImageCount={hasProcessed ? baseZipImages.length : undefined}
            salvagedImageCount={hasProcessed ? stats.restored : undefined}
          />

          {/* Process Button */}
          <div className="flex justify-center gap-4 mt-4">
            <Button
              onClick={handleProcess}
              disabled={!baseZipFile || isProcessing}
              className="action-button-cyan px-8"
            >
              <Play className="w-4 h-4 mr-2" />
              Stitch & Process
            </Button>

            {hasProcessed && (
              <Button
                onClick={handleReset}
                variant="outline"
                className="px-8"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
        </section>

        {/* Results Section */}
        {hasProcessed && items.length > 0 && (
          <>
            <ExportPanel
              items={items}
              onExportJSON={handleExportJSON}
              onExportTXT={handleExportTXT}
              onExportPDF={handleExportPDF}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
            />

            <FormulaList
              items={filteredItems}
              onStatusChange={updateItemStatus}
              onLatexChange={updateItemLatex}
              onAiRecognize={handleAiRecognize}
            />
          </>
        )}
      </main>

      <ProcessingOverlay
        isVisible={isProcessing}
        message={processingMessage}
        progress={processingProgress}
      />
    </div>
  );
};

export default Index;
