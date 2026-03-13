'use client';

import { Button } from '@/components/ui/button';
import { usePwa } from '@/components/pwa-provider';
import { Download, Smartphone } from 'lucide-react';

interface PwaInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export function PwaInstallButton({ compact = false, className }: PwaInstallButtonProps) {
  const { canInstall, isInstalled, promptInstall } = usePwa();

  if (isInstalled) {
    return (
      <Button type="button" variant="outline" size={compact ? 'icon' : 'sm'} className={className} disabled>
        {compact ? <Smartphone className="h-4 w-4" /> : <>
          <Smartphone className="mr-2 h-4 w-4" />
          Installed
        </>}
      </Button>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? 'icon' : 'sm'}
      className={className}
      onClick={() => void promptInstall()}
      aria-label="Install app"
    >
      {compact ? <Download className="h-4 w-4" /> : <>
        <Download className="mr-2 h-4 w-4" />
        Install App
      </>}
    </Button>
  );
}
