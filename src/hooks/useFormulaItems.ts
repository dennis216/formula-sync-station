import { useState, useCallback, useMemo } from 'react';
import type { FormulaItem, ParsedPDFEntry, ZipImageEntry, SalvagedPDFImage } from '@/types/formula';
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

  // Apply salvaged images from PDF to matching items
  const applySalvagedImages = useCallback(
    (salvagedImages: SalvagedPDFImage[]) => {
      setItems((prev) => {
        const salvagedMap = new Map<number, SalvagedPDFImage>();
        salvagedImages.forEach((img) => salvagedMap.set(img.posNumber, img));

        return prev.map((item) => {
          const salvaged = salvagedMap.get(item.posNumber);
          if (salvaged) {
            return {
              ...item,
              salvagedImageUrl: salvaged.url,
              salvagedImageBlob: salvaged.blob,
              status: 'restored' as const,
              aiError: null, // Clear previous errors since we have a good image now
            };
          }
          return item;
        });
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
