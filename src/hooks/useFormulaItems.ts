import { useState, useCallback, useMemo } from 'react';
import type { FormulaItem, ParsedPDFEntry, ZipImageEntry } from '@/types/formula';
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
          imageBlob: matchedImage?.blob || null, // Store the original blob
          status: matchedImage ? 'pending' : 'missing',
          latex: null,
          isProcessing: false,
        };
      });

      setItems(newItems);
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
      prev.map((item) => (item.id === id ? { ...item, latex } : item))
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

  return {
    items,
    filteredItems,
    filterStatus,
    setFilterStatus,
    buildItems,
    updateItemStatus,
    updateItemLatex,
    setItemProcessing,
    clearItems,
  };
}
