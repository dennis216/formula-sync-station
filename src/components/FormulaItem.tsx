import React, { useState, memo } from 'react';
import { Sparkles, ImageOff, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { LaTeXPreview } from './LaTeXPreview';
import type { FormulaItem as FormulaItemType } from '@/types/formula';

interface FormulaItemProps {
  item: FormulaItemType;
  onStatusChange: (id: string, status: FormulaItemType['status']) => void;
  onLatexChange: (id: string, latex: string) => void;
  onAiRecognize: (id: string) => void;
}

export const FormulaItem: React.FC<FormulaItemProps> = memo(({
  item,
  onStatusChange,
  onLatexChange,
  onAiRecognize,
}) => {
  const [showLatex, setShowLatex] = useState(!!item.latex);

  const cycleStatus = () => {
    const statusOrder: FormulaItemType['status'][] = ['pending', 'verified', 'needs-modification', 'restored'];
    const currentIndex = statusOrder.indexOf(item.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    onStatusChange(item.id, statusOrder[nextIndex]);
  };

  // Determine which image to display - prioritize salvaged image
  const displayImageUrl = item.salvagedImageUrl || item.imageUrl;
  const isRestored = !!item.salvagedImageUrl;
  const isWmfPlaceholder = !item.salvagedImageUrl && item.imageUrl === '/placeholder.svg';

  return (
    <div className="industrial-panel p-4 animate-fade-in">
      <div className="flex gap-4">
        {/* Position Info */}
        <div className="flex-shrink-0 w-24">
          <div className="text-primary font-bold text-lg text-glow">
            POS #{item.posNumber}
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate" title={item.imageRef}>
            {item.imageRef}
          </div>
          {item.imageName && (
            <div className="text-xs text-muted-foreground/70 mt-0.5 truncate" title={item.imageName}>
              {item.imageName}
            </div>
          )}
          {isRestored && (
            <div className="flex items-center gap-1 mt-2 text-xs text-accent">
              <RefreshCcw className="w-3 h-3" />
              <span>Patched</span>
            </div>
          )}
        </div>

        {/* Image Display */}
        <div className="flex-shrink-0">
          {item.status === 'missing' || !displayImageUrl ? (
            <div className="w-32 h-24 formula-image flex flex-col items-center justify-center gap-2 bg-destructive/10 border-destructive/30">
              <ImageOff className="w-8 h-8 text-destructive/60" />
              <span className="text-xs text-destructive uppercase tracking-wider">Missing</span>
            </div>
          ) : isWmfPlaceholder ? (
            <div className="w-32 h-24 formula-image flex flex-col items-center justify-center gap-2 bg-accent/20 border-accent/40">
              <Sparkles className="w-8 h-8 text-accent" />
              <span className="text-xs text-accent uppercase tracking-wider text-center px-1">
                WMF/EMF<br/>Awaiting PDF
              </span>
            </div>
          ) : (
            <img
              src={displayImageUrl}
              alt={`POS #${item.posNumber}`}
              className={`formula-image max-w-48 max-h-32 object-contain ${isRestored ? 'ring-2 ring-accent' : ''}`}
              loading="lazy"
            />
          )}
        </div>

        {/* Actions & LaTeX */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={item.status} onClick={cycleStatus} />
            
            <Button
              size="sm"
              onClick={() => onAiRecognize(item.id)}
              disabled={item.isProcessing || item.status === 'missing'}
              className="action-button-cyan h-7 px-3 text-xs"
            >
              {item.isProcessing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Recognize
                </>
              )}
            </Button>

            {item.latex && !showLatex && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLatex(true)}
                className="h-7 px-3 text-xs"
              >
                Show LaTeX
              </Button>
            )}
          </div>

          {(showLatex || item.latex) && item.latex && (
            <LaTeXPreview
              latex={item.latex}
              onChange={(latex) => onLatexChange(item.id, latex)}
            />
          )}

          {item.aiError && (
            <div className="rounded-md border bg-muted p-2 text-xs text-foreground">
              {item.aiError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

FormulaItem.displayName = 'FormulaItem';
