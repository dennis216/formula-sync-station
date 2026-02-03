import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { FileUploader } from '@/components/FileUploader';
import { FormulaList } from '@/components/FormulaList';
import { ExportPanel } from '@/components/ExportPanel';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { useFormulaItems } from '@/hooks/useFormulaItems';
import { parsePDFSimple } from '@/utils/pdfParser';
import { parseZip, cleanupImageUrls } from '@/utils/zipParser';
import { exportToJSON, exportToTXT, downloadFile } from '@/utils/exportUtils';
import type { ZipImageEntry } from '@/types/formula';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingProgress, setProcessingProgress] = useState<number | undefined>();
  const [zipImages, setZipImages] = useState<ZipImageEntry[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);

  const {
    items,
    filteredItems,
    filterStatus,
    setFilterStatus,
    buildItems,
    updateItemStatus,
    updateItemLatex,
    setItemProcessing,
    clearItems,
  } = useFormulaItems();

  const handleFilesSelected = useCallback(
    (zip: File | null, pdf: File | null) => {
      setZipFile(zip);
      setPdfFile(pdf);
    },
    []
  );

  const handleProcess = async () => {
    if (!zipFile || !pdfFile) {
      toast.error('Please upload both ZIP and PDF files');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Clean up previous URLs
      cleanupImageUrls(zipImages.map((img) => img.url));

      // Parse ZIP
      setProcessingMessage('Extracting images from archive...');
      setProcessingProgress(20);
      
      let images: ZipImageEntry[] = [];
      try {
        images = await parseZip(zipFile);
        setZipImages(images);
      } catch (zipError) {
        const errorMsg = zipError instanceof Error ? zipError.message : 'Unknown ZIP error';
        console.error('[ZIP] Parse failed:', zipError);
        toast.error(`ZIP extraction failed: ${errorMsg}`);
        setIsProcessing(false);
        return;
      }
      
      if (images.length === 0) {
        toast.error('No supported images found in ZIP. Only PNG/JPG/JPEG are supported. WMF/EMF files are skipped.');
        setIsProcessing(false);
        return;
      }

      // Parse PDF
      setProcessingMessage('Parsing PDF index...');
      setProcessingProgress(50);
      
      let pdfEntries: { posNumber: number; imageRef: string }[] = [];
      try {
        pdfEntries = await parsePDFSimple(pdfFile);
      } catch (pdfError) {
        const errorMsg = pdfError instanceof Error ? pdfError.message : 'Unknown PDF error';
        console.error('[PDF] Parse failed:', pdfError);
        toast.error(`PDF parsing failed: ${errorMsg}`);
        setIsProcessing(false);
        return;
      }

      if (pdfEntries.length === 0) {
        toast.error(
          'No "Pos #" entries found in PDF. The PDF may lack a text layer (scanned document) or use a different format.',
          { duration: 6000 }
        );
        setIsProcessing(false);
        return;
      }

      // Build items
      setProcessingMessage('Matching images to positions...');
      setProcessingProgress(80);
      buildItems(pdfEntries, images);

      setProcessingProgress(100);
      setHasProcessed(true);
      
      toast.success(
        `Loaded ${pdfEntries.length} positions with ${images.length} images`
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
    cleanupImageUrls(zipImages.map((img) => img.url));
    setZipFile(null);
    setPdfFile(null);
    setZipImages([]);
    clearItems();
    setHasProcessed(false);
    toast.info('Workspace cleared');
  };

  const handleAiRecognize = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || !item.imageUrl) {
      toast.error('Cannot process missing image');
      return;
    }

    setItemProcessing(id, true);

    try {
      // Convert blob URL to base64
      const response = await fetch(item.imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });
      
      const imageBase64 = await base64Promise;

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('recognize-formula', {
        body: { imageBase64 },
      });

      if (error) {
        throw new Error(error.message || 'AI recognition failed');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const latex = data.latex;
      
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

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />

      <main className="container py-6 space-y-6">
        {/* Upload Section */}
        <section>
          <FileUploader
            zipFile={zipFile}
            pdfFile={pdfFile}
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
          />

          {/* Process Button */}
          <div className="flex justify-center gap-4 mt-4">
            <Button
              onClick={handleProcess}
              disabled={!zipFile || !pdfFile || isProcessing}
              className="action-button-cyan px-8"
            >
              <Play className="w-4 h-4 mr-2" />
              Process Files
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
