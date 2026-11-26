import { Agent, request as undiciRequest } from 'undici';
import type { PowerAction, RrdTimeframe, VmType } from 'shared';

export interface ProxmoxConnectionConfig {
  host: string;
  port: number;
  pveNodeName: string;
  apiTokenId: string;
  apiTokenSecret: string;
  verifyTls: boolean;
}

interface ProxmoxApiResponse<T> {
  data: T;
}

export interface ProxmoxVersionData {
  version: string;
  release: string;
  repoid: string;
}

export interface ProxmoxNodeStatusData {
  cpu: number;
  cpuinfo?: { cpus?: number; model?: string };
  memory?: { used: number; total: number };
  rootfs?: { used: number; total: number };
  uptime?: number;
  pveversion?: string;
}

export interface ProxmoxVmRaw {
  vmid: number;
  name?: string;
  status: string;
  cpus?: number;
  maxmem?: number;
  mem?: number;
  maxdisk?: number;
  disk?: number;
  uptime?: number;
  template?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

export class ProxmoxClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly dispatcher: Agent;
  private readonly pveNodeName: string;

  constructor(config: ProxmoxConnectionConfig) {
    this.baseUrl = `https://${config.host}:${config.port}/api2/json`;
    this.authHeader = `PVEAPIToken=${config.apiTokenId}=${config.apiTokenSecret}`;
    this.pveNodeName = config.pveNodeName;
    this.dispatcher = new Agent({
      connect: {
        rejectUnauthorized: config.verifyTls,
        timeout: DEFAULT_TIMEOUT_MS,
      },
    });
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
    };

    let encodedBody: string | undefined;
    if (body) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined) {
          params.append(k, String(v));
        }
      }
      encodedBody = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const res = await undiciRequest(url, {
      method,
      headers,
      body: encodedBody,
      dispatcher: this.dispatcher,
      headersTimeout: DEFAULT_TIMEOUT_MS,
      bodyTimeout: DEFAULT_TIMEOUT_MS,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const text = await res.body.text();
      throw new Error(`Proxmox API error (${res.statusCode}) on ${path}: ${text}`);
    }

    const json = (await res.body.json()) as ProxmoxApiResponse<T>;
    return json.data;
  }

  async getVersion(): Promise<ProxmoxVersionData> {
    return this.request<ProxmoxVersionData>('GET', '/version');
  }

  async getNodeStatus(): Promise<ProxmoxNodeStatusData> {
    return this.request<ProxmoxNodeStatusData>(
      'GET',
      `/nodes/${encodeURIComponent(this.pveNodeName)}/status`
    );
  }

  async listVmsAndLxc(): Promise<{
    qemu: ProxmoxVmRaw[];
    lxc: ProxmoxVmRaw[];
  }> {
    const node = encodeURIComponent(this.pveNodeName);
    const [qemuRes, lxcRes] = await Promise.allSettled([
      this.request<ProxmoxVmRaw[]>('GET', `/nodes/${node}/qemu`),
      this.request<ProxmoxVmRaw[]>('GET', `/nodes/${node}/lxc`),
    ]);

    return {
      qemu: qemuRes.status === 'fulfilled' ? qemuRes.value : [],
      lxc: lxcRes.status === 'fulfilled' ? lxcRes.value : [],
    };
  }

  async getStorageAndTemplates(): Promise<{
    storages: Array<Record<string, unknown>>;
    networks: Array<Record<string, unknown>>;
    isos: Array<Record<string, unknown>>;
    lxcTemplates: Array<Record<string, unknown>>;
  }> {
    const node = encodeURIComponent(this.pveNodeName);
    const [storages, networks] = await Promise.all([
      this.request<Array<Record<string, unknown>>>('GET', `/nodes/${node}/storage`),
      this.request<Array<Record<string, unknown>>>('GET', `/nodes/${node}/network`),
    ]);

    const isoStorages = storages.filter(
      (s) => typeof s.content === 'string' && s.content.includes('iso')
    );
    const vztmplStorages = storages.filter(
      (s) => typeof s.content === 'string' && s.content.includes('vztmpl')
    );

    const isoResults = await Promise.allSettled(
      isoStorages.map((s) =>
        this.request<Array<Record<string, unknown>>>(
          'GET',
          `/nodes/${node}/storage/${encodeURIComponent(String(s.storage))}/content?content=iso`
        )
      )
    );

    const tplResults = await Promise.allSettled(
      vztmplStorages.map((s) =>
        this.request<Array<Record<string, unknown>>>(
          'GET',
          `/nodes/${node}/storage/${encodeURIComponent(String(s.storage))}/content?content=vztmpl`
        )
      )
    );

    const isos = isoResults.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    const lxcTemplates = tplResults.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : []
    );

    return { storages, networks, isos, lxcTemplates };
  }

  async cloneVm(input: {
    templateVmid: number;
    newVmid: number;
    name: string;
    targetStorage?: string;
    cores?: number;
    memoryMb?: number;
    cloudInitUser?: string;
    cloudInitPassword?: string;
    cloudInitSshKeys?: string;
    ipConfig?: string;
    startAfterCreate?: boolean;
  }): Promise<string> {
    const node = encodeURIComponent(this.pveNodeName);
    const upid = await this.request<string>(
      'POST',
      `/nodes/${node}/qemu/${input.templateVmid}/clone`,
      {
        newid: input.newVmid,
        name: input.name,
        full: 1,
        storage: input.targetStorage,
      }
    );

    if (
      input.cores !== undefined ||
      input.memoryMb !== undefined ||
      input.cloudInitUser !== undefined ||
      input.cloudInitPassword !== undefined ||
      input.cloudInitSshKeys !== undefined ||
      input.ipConfig !== undefined
    ) {
      await this.request<unknown>('PUT', `/nodes/${node}/qemu/${input.newVmid}/config`, {
        cores: input.cores,
        memory: input.memoryMb,
        ciuser: input.cloudInitUser,
        cipassword: input.cloudInitPassword,
        sshkeys: input.cloudInitSshKeys
          ? encodeURIComponent(input.cloudInitSshKeys)
          : undefined,
        ipconfig0: input.ipConfig,
      });
    }

    if (input.startAfterCreate) {
      await this.powerAction('qemu', input.newVmid, 'start').catch(() => undefined);
    }

    return upid;
  }

  async createIsoVm(input: {
    vmid: number;
    name: string;
    isoStorage: string;
    isoFile: string;
    diskStorage: string;
    diskSizeGb: number;
    cores: number;
    memoryMb: number;
    bridge: string;
    osType: string;
    startAfterCreate?: boolean;
  }): Promise<string> {
    const node = encodeURIComponent(this.pveNodeName);
    const upid = await this.request<string>('POST', `/nodes/${node}/qemu`, {
      vmid: input.vmid,
      name: input.name,
      cores: input.cores,
      memory: input.memoryMb,
      ostype: input.osType,
      scsihw: 'virtio-scsi-pci',
      scsi0: `${input.diskStorage}:${input.diskSizeGb}`,
      ide2: `${input.isoStorage}:iso/${input.isoFile},media=cdrom`,
      net0: `virtio,bridge=${input.bridge}`,
      boot: 'order=ide2;scsi0',
    });

    if (input.startAfterCreate) {
      await this.powerAction('qemu', input.vmid, 'start').catch(() => undefined);
    }

    return upid;
  }

  async createLxc(input: {
    vmid: number;
    hostname: string;
    osTemplate: string;
    rootStorage: string;
    diskSizeGb: number;
    cores: number;
    memoryMb: number;
    swapMb: number;
    bridge: string;
    password?: string;
    sshPublicKeys?: string;
    ipConfig: string;
    unprivileged: boolean;
    startAfterCreate?: boolean;
  }): Promise<string> {
    const node = encodeURIComponent(this.pveNodeName);
    const upid = await this.request<string>('POST', `/nodes/${node}/lxc`, {
      vmid: input.vmid,
      hostname: input.hostname,
      ostemplate: input.osTemplate,
      rootfs: `${input.rootStorage}:${input.diskSizeGb}`,
      cores: input.cores,
      memory: input.memoryMb,
      swap: input.swapMb,
      net0: `name=eth0,bridge=${input.bridge},${input.ipConfig}`,
      password: input.password,
      'ssh-public-keys': input.sshPublicKeys,
      unprivileged: input.unprivileged ? 1 : 0,
      start: input.startAfterCreate ? 1 : 0,
    });

    return upid;
  }

  async powerAction(vmType: VmType, vmid: number, action: PowerAction): Promise<string> {
    const node = encodeURIComponent(this.pveNodeName);
    return this.request<string>(
      'POST',
      `/nodes/${node}/${vmType}/${vmid}/status/${action}`
    );
  }

  async getRrdData(
    scope: 'node' | VmType,
    timeframe: RrdTimeframe,
    vmid?: number
  ): Promise<Array<Record<string, unknown>>> {
    const node = encodeURIComponent(this.pveNodeName);
    const path =
      scope === 'node'
        ? `/nodes/${node}/rrddata?timeframe=${timeframe}`
        : `/nodes/${node}/${scope}/${vmid}/rrddata?timeframe=${timeframe}`;
    return this.request<Array<Record<string, unknown>>>('GET', path);
  }

  async createVncProxy(
    vmType: VmType,
    vmid: number
  ): Promise<{ ticket: string; port: number; user: string; cert?: string }> {
    const node = encodeURIComponent(this.pveNodeName);
    return this.request<{ ticket: string; port: number; user: string; cert?: string }>(
      'POST',
      `/nodes/${node}/${vmType}/${vmid}/vncproxy`,
      { websocket: 1 }
    );
  }

  async createTermProxy(
    vmType: VmType,
    vmid: number
  ): Promise<{ ticket: string; port: number; user: string }> {
    const node = encodeURIComponent(this.pveNodeName);
    return this.request<{ ticket: string; port: number; user: string }>(
      'POST',
      `/nodes/${node}/${vmType}/${vmid}/termproxy`
    );
  }

  async getTaskStatus(upid: string): Promise<Record<string, unknown>> {
    const node = encodeURIComponent(this.pveNodeName);
    return this.request<Record<string, unknown>>(
      'GET',
      `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`
    );
  }
}
