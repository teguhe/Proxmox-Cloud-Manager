import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X } from 'lucide-react';
import type { VmSummaryDto } from 'shared';
import { apiFetch, getWsUrl } from '../lib/api';

type SshMode = 'termproxy' | 'direct';

export function SshTerminalModal({
  vm,
  onClose,
}: {
  vm: VmSummaryDto;
  onClose: () => void;
}) {
  const termRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [mode, setMode] = useState<SshMode>('termproxy');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [connected, setConnected] = useState(false);

  const startSession = async () => {
    if (!termRef.current) return;
    wsRef.current?.close();
    termRef.current.innerHTML = '';

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      theme: { background: '#09090B' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);
    fit.fit();

    const { wsToken } = await apiFetch<{ wsToken: string }>(
      `/vms/${vm.nodeId}/${vm.vmType}/${vm.vmid}/console-ticket`,
      { method: 'POST' }
    );

    const path =
      mode === 'termproxy'
        ? `/termproxy/${vm.nodeId}/${vm.vmType}/${vm.vmid}?token=${encodeURIComponent(wsToken)}`
        : `/ssh/${vm.nodeId}/${vm.vmType}/${vm.vmid}?token=${encodeURIComponent(wsToken)}`;

    const ws = new WebSocket(getWsUrl(path));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (mode === 'direct') {
        ws.send(
          JSON.stringify({
            type: 'auth',
            host,
            port: Number(port) || 22,
            username,
            password,
          })
        );
      }
    };

    ws.onmessage = (ev) => {
      term.write(typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data));
    };

    ws.onclose = () => {
      setConnected(false);
      term.write('\r\n[Connection closed]\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const onResize = () => {
      fit.fit();
      if (mode === 'direct' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };
    window.addEventListener('resize', onResize);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[80vh] rounded-xl bg-[#18181B] border border-[#27272A] flex flex-col overflow-hidden text-white">
        <div className="px-4 py-3 border-b border-[#27272A] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">SSH / Terminal: {vm.name}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SshMode)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs"
            >
              <option value="termproxy">Proxmox Termproxy</option>
              <option value="direct">Direct SSH (ssh2)</option>
            </select>
            {mode === 'direct' && (
              <div className="flex items-center gap-2">
                <input
                  placeholder="Host/IP"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs w-32"
                />
                <input
                  placeholder="Port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs w-16"
                />
                <input
                  placeholder="User"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs w-24"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs w-28"
                />
              </div>
            )}
            <button
              onClick={startSession}
              className="px-3 py-1 rounded bg-[#2563EB] hover:bg-blue-700 text-xs font-medium"
            >
              {connected ? 'Reconnect' : 'Connect'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800"
            aria-label="Close SSH Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={termRef} className="flex-1 bg-[#09090B] p-2" />
      </div>
    </div>
  );
}
