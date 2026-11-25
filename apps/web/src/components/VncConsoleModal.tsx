import { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';
import { X } from 'lucide-react';
import type { VmSummaryDto } from 'shared';
import { apiFetch, getWsUrl } from '../lib/api';

export function VncConsoleModal({
  vm,
  onClose,
}: {
  vm: VmSummaryDto;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState('Requesting VNC ticket...');

  useEffect(() => {
    let rfb: RFB | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const { wsToken } = await apiFetch<{ wsToken: string }>(
          `/vms/${vm.nodeId}/${vm.vmType}/${vm.vmid}/console-ticket`,
          { method: 'POST' }
        );
        if (cancelled || !containerRef.current) return;

        setStatus('Connecting to VNC...');
        const wsUrl = getWsUrl(
          `/vnc/${vm.nodeId}/${vm.vmType}/${vm.vmid}?token=${encodeURIComponent(wsToken)}`
        );
        rfb = new RFB(containerRef.current, wsUrl);
        rfb.scaleViewport = true;
        rfb.resizeSession = true;
        rfb.addEventListener('connect', () => setStatus('Connected'));
        rfb.addEventListener('disconnect', () => setStatus('Disconnected'));
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'VNC connection failed');
      }
    }

    connect();

    return () => {
      cancelled = true;
      rfb?.disconnect();
    };
  }, [vm]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[80vh] rounded-xl bg-[#18181B] border border-[#27272A] flex flex-col overflow-hidden text-white">
        <div className="h-12 px-4 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">{vm.name}</span>
            <span className="font-mono text-xs text-zinc-400">
              VMID {vm.vmid} ({vm.nodeName})
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-emerald-400">
              {status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800"
            aria-label="Close VNC Console"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={containerRef} className="flex-1 bg-black" />
      </div>
    </div>
  );
}
