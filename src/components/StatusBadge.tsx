import React from 'react';
import { CheckCircle, AlertTriangle, HelpCircle, XCircle, RefreshCcw } from 'lucide-react';
import type { FormulaItem } from '@/types/formula';

interface StatusBadgeProps {
  status: FormulaItem['status'];
  onClick?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onClick }) => {
  const config: Record<FormulaItem['status'], { label: string; className: string; icon: React.ElementType }> = {
    pending: {
      label: 'Pending',
      className: 'status-pending',
      icon: HelpCircle,
    },
    verified: {
      label: 'Verified',
      className: 'status-verified',
      icon: CheckCircle,
    },
    'needs-modification': {
      label: 'Needs Fix',
      className: 'status-pending',
      icon: AlertTriangle,
    },
    missing: {
      label: 'Missing',
      className: 'status-missing',
      icon: XCircle,
    },
    restored: {
      label: 'Restored from PDF',
      className: 'status-restored',
      icon: RefreshCcw,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <button
      onClick={onClick}
      className={`status-badge ${className} flex items-center gap-1 transition-transform hover:scale-105`}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
};
