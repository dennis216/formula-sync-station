import React from 'react';
import { Database, Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-sm glow-border">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold uppercase tracking-wider text-foreground text-glow">
                Formula Archive Station
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Visual Reconciliation System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-4 h-4 text-primary" />
            <span className="uppercase tracking-wider">AI-Powered</span>
          </div>
        </div>
      </div>
    </header>
  );
};
