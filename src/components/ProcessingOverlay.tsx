import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  message: string;
  progress?: number;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  isVisible,
  message,
  progress,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="industrial-panel p-8 glow-border animate-pulse-glow">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">
              {message}
            </p>
            
            {progress !== undefined && (
              <div className="mt-4 w-48">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
