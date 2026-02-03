import React from 'react';
import { Download, FileJson, FileText, Filter, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FormulaItem } from '@/types/formula';

interface ExportPanelProps {
  items: FormulaItem[];
  onExportJSON: () => void;
  onExportTXT: () => void;
  onExportPDF: () => void;
  filterStatus: string | null;
  onFilterChange: (status: string | null) => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  items,
  onExportJSON,
  onExportTXT,
  onExportPDF,
  filterStatus,
  onFilterChange,
}) => {
  const stats = {
    total: items.length,
    verified: items.filter(i => i.status === 'verified').length,
    pending: items.filter(i => i.status === 'pending').length,
    needsModification: items.filter(i => i.status === 'needs-modification').length,
    missing: items.filter(i => i.status === 'missing').length,
  };

  return (
    <div className="industrial-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-xs uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total:</span>
            <span className="text-foreground font-bold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Verified:</span>
            <span className="text-success font-bold">{stats.verified}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Pending:</span>
            <span className="text-warning font-bold">{stats.pending}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Needs Fix:</span>
            <span className="text-warning font-bold">{stats.needsModification}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Missing:</span>
            <span className="text-destructive font-bold">{stats.missing}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="w-3 h-3 mr-2" />
                {filterStatus ? filterStatus.replace('-', ' ') : 'All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onFilterChange(null)}>
                All Items
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFilterChange('pending')}>
                Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFilterChange('verified')}>
                Verified
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFilterChange('needs-modification')}>
                Needs Modification
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFilterChange('missing')}>
                Missing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* PDF Export - Premium Button */}
          <Button 
            onClick={onExportPDF} 
            className="action-button-cyan h-8"
          >
            <FileImage className="w-3 h-3 mr-2" />
            Export Full PDF
          </Button>

          {/* Other Exports */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Download className="w-3 h-3 mr-2" />
                More Formats
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportJSON}>
                <FileJson className="w-4 h-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportTXT}>
                <FileText className="w-4 h-4 mr-2" />
                Export as TXT
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
