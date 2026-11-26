export const USER_ROLES = [
  'super_admin',
  'admin',
  'operator',
  'audit',
  'no_access',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const VM_TYPES = ['qemu', 'lxc'] as const;

export type VmType = (typeof VM_TYPES)[number];

export const POWER_ACTIONS = [
  'start',
  'stop',
  'shutdown',
  'reboot',
  'reset',
] as const;

export type PowerAction = (typeof POWER_ACTIONS)[number];

export const RRD_TIMEFRAMES = [
  'hour',
  'day',
  'week',
  'month',
  'year',
] as const;

export type RrdTimeframe = (typeof RRD_TIMEFRAMES)[number];

export const REPORT_TYPES = ['inventory', 'allocation', 'logs'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export interface UserDto {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isProtected: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProxmoxNodeDto {
  id: string;
  name: string;
  pveNodeName: string;
  host: string;
  port: number;
  apiTokenId: string;
  verifyTls: boolean;
  description: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProxmoxNodeStatusDto extends ProxmoxNodeDto {
  status: 'online' | 'offline' | 'unreachable';
  cpuUsage?: number;
  maxCpu?: number;
  memUsed?: number;
  memTotal?: number;
  diskUsed?: number;
  diskTotal?: number;
  uptime?: number;
  pveVersion?: string;
}

export interface VmSummaryDto {
  nodeId: string;
  nodeName: string;
  pveNodeName: string;
  vmid: number;
  name: string;
  vmType: VmType;
  status: string;
  cpus: number;
  maxmem: number;
  mem: number;
  maxdisk: number;
  disk: number;
  uptime: number;
  template?: boolean;
  ipAddress?: string | null;
}

export interface OperatorAssignmentDto {
  id: string;
  userId: string;
  nodeId: string;
  vmid: number;
  vmType: VmType;
  vmNameCache: string | null;
  assignedBy: string | null;
  createdAt: string;
}

export interface ActivityLogDto {
  id: number;
  userId: string | null;
  userEmail: string;
  userRole: UserRole;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  status: 'success' | 'failed';
  createdAt: string;
}
