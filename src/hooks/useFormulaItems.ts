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
   * STRICT MATCHING: Extracts number from imageRef (e.g., "image70" -> 70)
   * and matches to salvaged image's imageNumber.
   */
  const applySalvagedImages = useCallback(
    (salvagedImages: SalvagedZipImage[]) => {
      console.log(`[Stitcher] ========================================`);
      console.log(`[Stitcher] Starting stitch with ${salvagedImages.length} salvaged images`);
      
      // Build a map: imageNumber -> SalvagedZipImage for O(1) lookup
      const salvagedMap = new Map<number, SalvagedZipImage>();
      salvagedImages.forEach((img) => {
        salvagedMap.set(img.imageNumber, img);
        console.log(`[Stitcher] Indexed: #${img.imageNumber} -> ${img.filename} (${img.blob.size} bytes, ${img.blob.type})`);
      });

      setItems((prevItems) => {
        console.log(`[Stitcher] Processing ${prevItems.length} items...`);
        let matchCount = 0;
        let noNumberCount = 0;
        let noMatchCount = 0;
        
        const updatedItems = prevItems.map((item) => {
          // STRICT: Extract number from imageRef (e.g., "image70" -> 70)
          // imageRef is the base name without extension from the ZIP
          const refSource = item.imageRef || item.imageName || '';
          const numberMatch = refSource.match(/(\d+)/);
          
          if (!numberMatch) {
            noNumberCount++;
            console.log(`[Stitcher] ⚠️ No number found in: "${refSource}" (POS #${item.posNumber})`);
            return item;
          }
          
          const extractedNumber = parseInt(numberMatch[1], 10);
          const salvaged = salvagedMap.get(extractedNumber);
          
          if (salvaged) {
            matchCount++;
            console.log(`[Stitcher] ✅ MATCH POS #${item.posNumber}: "${refSource}" (#${extractedNumber}) -> ${salvaged.filename}`);
            console.log(`[Stitcher]    New URL: ${salvaged.url}`);
            console.log(`[Stitcher]    Blob: ${salvaged.blob.size} bytes, type=${salvaged.blob.type}`);
            
            // CRITICAL: Update BOTH salvaged fields AND clear errors
            // The FormulaItem component and AI recognition will use these
            return {
              ...item,
              // Store the patched image data
              salvagedImageUrl: salvaged.url,
              salvagedImageBlob: salvaged.blob,
              // Update status to restored
              status: 'restored' as const,
              // Clear any previous AI errors since we now have a good image
              aiError: null,
            };
          } else {
            noMatchCount++;
            console.log(`[Stitcher] ❌ No patch for POS #${item.posNumber}: "${refSource}" (#${extractedNumber})`);
          }
          
          return item;
        });
        
        console.log(`[Stitcher] ========================================`);
        console.log(`[Stitcher] STITCH COMPLETE:`);
        console.log(`[Stitcher]   ✅ Matched: ${matchCount}`);
        console.log(`[Stitcher]   ❌ No patch found: ${noMatchCount}`);
        console.log(`[Stitcher]   ⚠️ No number in ref: ${noNumberCount}`);
        console.log(`[Stitcher] ========================================`);
        
        return updatedItems;
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
