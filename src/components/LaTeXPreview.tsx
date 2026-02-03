import React, { useState, useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface LaTeXPreviewProps {
  latex: string;
  onChange?: (latex: string) => void;
  editable?: boolean;
}

export const LaTeXPreview: React.FC<LaTeXPreviewProps> = ({
  latex,
  onChange,
  editable = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(latex);
  const [error, setError] = useState<string | null>(null);

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange && editValue !== latex) {
      onChange(editValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
    setError(null);
  };

  const renderedLatex = useMemo(() => {
    try {
      // Determine if this is a block or inline formula
      const isBlock = latex.includes('\\begin') || 
                      latex.includes('\\frac') || 
                      latex.includes('\\sum') ||
                      latex.includes('\\int') ||
                      latex.length > 50;
      
      return isBlock ? (
        <BlockMath math={editValue} />
      ) : (
        <InlineMath math={editValue} />
      );
    } catch (err: any) {
      setError(err.message || 'Invalid LaTeX');
      return null;
    }
  }, [editValue, latex]);

  if (isEditing && editable) {
    return (
      <div className="space-y-2">
        <textarea
          value={editValue}
          onChange={handleChange}
          onBlur={handleBlur}
          autoFocus
          className="w-full h-24 p-2 bg-muted border border-border rounded-sm 
                     font-mono text-sm text-foreground resize-none
                     focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Enter LaTeX..."
        />
        <div className="latex-preview min-h-[40px] flex items-center justify-center">
          {error ? (
            <span className="text-destructive text-xs">{error}</span>
          ) : (
            renderedLatex
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => editable && setIsEditing(true)}
      className={`latex-preview min-h-[40px] flex items-center justify-center
                  ${editable ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
    >
      {error ? (
        <span className="text-destructive text-xs">{error}</span>
      ) : (
        renderedLatex
      )}
    </div>
  );
};
