import { useState, useCallback, useMemo } from 'react';
import type { FormulaItem, ParsedPDFEntry, ZipImageEntry, SalvagedZipImage } from '@/types/formula';
import { matchImageToRef } from '@/utils/zipParser';

export function useFormulaItems() {
  const [items, setItems] = useState<FormulaItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const buildItems = useCallback(
    (pdfEntries: ParsedPDFEntry[], zipImages: ZipImageEntry[], useFallbackMapping = false) => {
      const newItems: FormulaItem[] = pdfEntries.map((entry, index) => {
        let matchedImage: ZipImageEntry | null = null;
        
        if (useFallbackMapping) {
          // In fallback mode, images are already sorted and matched by index
          matchedImage = zipImages[index] || null;
        } else {
          // Normal mode: match by image reference pattern
          matchedImage = matchImageToRef(entry.imageRef, zipImages);
        }

        return {
          id: `pos-${entry.posNumber}`,
          posNumber: entry.posNumber,
          imageRef: entry.imageRef,
          imageName: matchedImage?.filename || null,
          imageUrl: matchedImage?.url || null,
          imageBlob: matchedImage?.blob || null,
          salvagedImageUrl: null,
          salvagedImageBlob: null,
          status: matchedImage ? 'pending' : 'missing',
          latex: null,
          aiError: null,
          isProcessing: false,
        };
      });

      setItems(newItems);
    },
    []
  );

  /**
   * Apply salvaged images from Patch ZIP to matching items.
   * Matches by extracting the number from the original imageName (e.g., image70.wmf -> 70)
   * and comparing it to the salvaged image's imageNumber.
   */
  const applySalvagedImages = useCallback(
    (salvagedImages: SalvagedZipImage[]) => {
      console.log(`[Stitcher] Applying ${salvagedImages.length} salvaged images...`);
      
      // Build a map: imageNumber -> SalvagedZipImage
      const salvagedMap = new Map<number, SalvagedZipImage>();
      salvagedImages.forEach((img) => {
        salvagedMap.set(img.imageNumber, img);
        console.log(`[Stitcher] Salvage map: ${img.imageNumber} -> ${img.filename}`);
      });

      setItems((prev) => {
        let matchCount = 0;
        
        const updated = prev.map((item) => {
          // Extract the number from the original image filename (e.g., image70.wmf -> 70)
          const originalName = item.imageName || item.imageRef || '';
          const numberMatch = originalName.match(/(\d+)/);
          
          if (!numberMatch) {
            console.log(`[Stitcher] No number in: ${originalName}`);
            return item;
          }
          
          const imageNumber = parseInt(numberMatch[1], 10);
          const salvaged = salvagedMap.get(imageNumber);
          
          if (salvaged) {
            matchCount++;
            console.log(`[Stitcher] ✅ MATCH: ${originalName} (${imageNumber}) -> ${salvaged.filename}`);
            console.log(`[Stitcher]    URL: ${salvaged.url}`);
            console.log(`[Stitcher]    Blob size: ${salvaged.blob.size} bytes`);
            
            return {
              ...item,
              salvagedImageUrl: salvaged.url,
              salvagedImageBlob: salvaged.blob,
              status: 'restored' as const,
              aiError: null, // Clear previous errors since we have a good image now
            };
          } else {
            console.log(`[Stitcher] ❌ No match for: ${originalName} (${imageNumber})`);
          }
          return item;
        });
        
        console.log(`[Stitcher] Total matches: ${matchCount}/${prev.length}`);
        return updated;
      });
    },
    []
  );

  const updateItemStatus = useCallback(
    (id: string, status: FormulaItem['status']) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
    },
    []
  );

  const updateItemLatex = useCallback((id: string, latex: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, latex, aiError: null } : item))
    );
  }, []);

  const updateItemAiError = useCallback((id: string, aiError: string | null) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, aiError } : item))
    );
  }, []);

  const setItemProcessing = useCallback((id: string, isProcessing: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isProcessing } : item))
    );
  }, []);

  const filteredItems = useMemo(() => {
    if (!filterStatus) return items;
    return items.filter((item) => item.status === filterStatus);
  }, [items, filterStatus]);

  const clearItems = useCallback(() => {
    setItems([]);
    setFilterStatus(null);
  }, []);

  // Get counts for statistics
  const stats = useMemo(() => ({
    total: items.length,
    restored: items.filter((i) => i.status === 'restored').length,
    pending: items.filter((i) => i.status === 'pending').length,
    verified: items.filter((i) => i.status === 'verified').length,
    missing: items.filter((i) => i.status === 'missing').length,
    needsModification: items.filter((i) => i.status === 'needs-modification').length,
  }), [items]);

  return {
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
  };
}
