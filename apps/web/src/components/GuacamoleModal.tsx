import { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import { Monitor, X } from 'lucide-react';
import type { VmSummaryDto } from 'shared';
import { apiFetch, getWsUrl } from '../lib/api';

interface GuacamoleModalProps {
  vm: VmSummaryDto;
  onClose: () => void;
}

export function GuacamoleModal({ vm, onClose }: GuacamoleModalProps) {
  const displayRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<{ disconnect: () => void } | null>(null);

  const [protocol, setProtocol] = useState<'rdp' | 'vnc' | 'ssh'>('rdp');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3389');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Masukkan detail koneksi remote (RDP / VNC / SSH)');

  const handleProtocolChange = (next: 'rdp' | 'vnc' | 'ssh') => {
    setProtocol(next);
    setPort(next === 'rdp' ? '3389' : next === 'vnc' ? '5900' : '22');
  };

  const disconnect = () => {
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
    if (displayRef.current) {
      displayRef.current.innerHTML = '';
    }
    setConnected(false);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const handleConnect = async () => {
    if (!host.trim()) {
      setStatus('Host / IP wajib diisi');
      return;
    }

    disconnect();
    setStatus('Meminta WS ticket...');

    try {
      const { ticket } = await apiFetch<{ ticket: string }>(
        `/vms/${vm.nodeId}/${vm.vmType}/${vm.vmid}/ws-ticket`,
        { method: 'POST' }
      );

      const params = new URLSearchParams({
        token: ticket,
        protocol,
        host: host.trim(),
        port: port.trim(),
        username: username.trim(),
        password,
      });

      const wsUrl = getWsUrl(`/guacamole/${vm.nodeId}/${vm.vmType}/${vm.vmid}?${params.toString()}`);
      const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
      const client = new Guacamole.Client(tunnel);
      clientRef.current = client;

      if (displayRef.current) {
        displayRef.current.innerHTML = '';
        displayRef.current.appendChild(client.getDisplay().getElement());
      }

      const mouse = new Guacamole.Mouse(client.getDisplay().getElement());
      mouse.onEach(['mousedown', 'mouseup', 'mousemove'], (e: { state: unknown }) => {
        client.sendMouseState(e.state);
      });

      const keyboard = new Guacamole.Keyboard(document);
      keyboard.onkeydown = (keysym: number) => {
        client.sendKeyEvent(1, keysym);
      };
      keyboard.onkeyup = (keysym: number) => {
        client.sendKeyEvent(0, keysym);
      };

      client.onstatechange = (state: number) => {
        if (state === 3) {
          setConnected(true);
          setStatus(`Connected (${protocol.toUpperCase()})`);
        } else if (state === 5) {
          setConnected(false);
          setStatus('Disconnected');
        }
      };

      client.onerror = (err: { message?: string }) => {
        setStatus(`Error: ${err.message || 'Connection failed'}`);
      };

      setStatus('Menghubungkan ke guacd...');
      client.connect();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Gagal terhubung');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-xl border border-[#27272A] bg-[#09090B] text-white overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium">
              Guacamole Remote: {vm.name} (VMID {vm.vmid})
            </span>
            <span className="text-xs text-zinc-400 ml-2">{status}</span>
          </div>
          <button
            onClick={() => {
              disconnect();
              onClose();
            }}
            className="p-1 rounded hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-[#27272A] bg-zinc-900/50 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={protocol}
            onChange={(e) => handleProtocolChange(e.target.value as 'rdp' | 'vnc' | 'ssh')}
            disabled={connected}
            className="px-2.5 py-1.5 rounded border border-[#27272A] bg-zinc-900"
          >
            <option value="rdp">RDP (Windows)</option>
            <option value="vnc">VNC</option>
            <option value="ssh">SSH</option>
          </select>
          <input
            placeholder="Host / IP VM"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={connected}
            className="px-2.5 py-1.5 rounded border border-[#27272A] bg-zinc-900 w-40"
          />
          <input
            placeholder="Port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            disabled={connected}
            className="px-2.5 py-1.5 rounded border border-[#27272A] bg-zinc-900 w-20"
          />
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={connected}
            className="px-2.5 py-1.5 rounded border border-[#27272A] bg-zinc-900 w-32"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={connected}
            className="px-2.5 py-1.5 rounded border border-[#27272A] bg-zinc-900 w-32"
          />
          {!connected ? (
            <button
              onClick={handleConnect}
              className="px-3 py-1.5 rounded bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              Disconnect
            </button>
          )}
        </div>

        <div
          ref={displayRef}
          className="flex-1 min-h-[420px] bg-black flex items-center justify-center overflow-auto"
        />
      </div>
    </div>
  );
}
