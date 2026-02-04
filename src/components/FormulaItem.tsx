import React, { useState, memo } from 'react';
import { Sparkles, ImageOff, Loader2, RefreshCcw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { LaTeXPreview } from './LaTeXPreview';
import { toast } from 'sonner';
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
  const [isCopying, setIsCopying] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  const cycleStatus = () => {
    const statusOrder: FormulaItemType['status'][] = ['pending', 'verified', 'needs-modification', 'restored'];
    const currentIndex = statusOrder.indexOf(item.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    onStatusChange(item.id, statusOrder[nextIndex]);
  };

  const handleCopyImage = async () => {
    // Only works with salvaged PNG images
    if (!item.salvagedImageBlob) {
      toast.error('No image data available to copy');
      return;
    }

    setIsCopying(true);

    try {
      // Ensure we have a PNG blob for clipboard compatibility
      let pngBlob = item.salvagedImageBlob;
      
      // If it's not already a PNG, we need to convert it
      if (item.salvagedImageBlob.type !== 'image/png') {
        // Create an image element and draw to canvas for conversion
        const img = new Image();
        const url = URL.createObjectURL(item.salvagedImageBlob);
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                pngBlob = blob;
                resolve();
              } else {
                reject(new Error('Failed to convert image to PNG'));
              }
            }, 'image/png');
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = url;
        });
        
        URL.revokeObjectURL(url);
      }

      // Use the Clipboard API to copy the image
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob
        })
      ]);

      setJustCopied(true);
      toast.success(`POS #${item.posNumber} copied to clipboard`);
      
      // Reset the "Copied!" state after 2 seconds
      setTimeout(() => {
        setJustCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy image:', error);
      toast.error('Failed to copy image to clipboard');
    } finally {
      setIsCopying(false);
    }
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
        <div className="flex-shrink-0 flex flex-col gap-2">
          {item.status === 'missing' || !displayImageUrl ? (
            <div className="w-32 h-24 formula-image flex flex-col items-center justify-center gap-2 bg-destructive/10 border-destructive/30">
              <ImageOff className="w-8 h-8 text-destructive/60" />
              <span className="text-xs text-destructive uppercase tracking-wider">Missing</span>
            </div>
          ) : isWmfPlaceholder ? (
            <div className="w-32 h-24 formula-image flex flex-col items-center justify-center gap-2 bg-accent/20 border-accent/40">
              <Sparkles className="w-8 h-8 text-accent" />
              <span className="text-xs text-accent uppercase tracking-wider text-center px-1">
                WMF/EMF<br/>Awaiting Patch
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
          
          {/* Copy Image Button - only show for restored items with salvaged blob */}
          {isRestored && item.salvagedImageBlob && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyImage}
              disabled={isCopying}
              className="h-6 px-2 text-xs w-fit"
            >
              {justCopied ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-accent" />
                  Copied!
                </>
              ) : isCopying ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Image
                </>
              )}
            </Button>
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
