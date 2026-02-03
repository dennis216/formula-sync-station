import React, { useCallback } from 'react';
import { FormulaItem } from './FormulaItem';
import type { FormulaItem as FormulaItemType } from '@/types/formula';

interface FormulaListProps {
  items: FormulaItemType[];
  onStatusChange: (id: string, status: FormulaItemType['status']) => void;
  onLatexChange: (id: string, latex: string) => void;
  onAiRecognize: (id: string) => void;
}

export const FormulaList: React.FC<FormulaListProps> = ({
  items,
  onStatusChange,
  onLatexChange,
  onAiRecognize,
}) => {
  const handleStatusChange = useCallback(
    (id: string, status: FormulaItemType['status']) => onStatusChange(id, status),
    [onStatusChange]
  );

  const handleLatexChange = useCallback(
    (id: string, latex: string) => onLatexChange(id, latex),
    [onLatexChange]
  );

  const handleAiRecognize = useCallback(
    (id: string) => onAiRecognize(id),
    [onAiRecognize]
  );

  if (items.length === 0) {
    return (
      <div className="industrial-panel p-12 text-center">
        <div className="text-muted-foreground">
          <p className="text-lg font-bold uppercase tracking-wider mb-2">
            No Items Loaded
          </p>
          <p className="text-sm">
            Upload a ZIP archive and PDF index to begin reconciliation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <FormulaItem
          key={item.id}
          item={item}
          onStatusChange={handleStatusChange}
          onLatexChange={handleLatexChange}
          onAiRecognize={handleAiRecognize}
        />
      ))}
    </div>
  );
};
