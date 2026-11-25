import { z } from 'zod';
import {
  POWER_ACTIONS,
  REPORT_FORMATS,
  REPORT_TYPES,
  RRD_TIMEFRAMES,
  USER_ROLES,
  VM_TYPES,
} from './types.js';

export const userRoleSchema = z.enum(USER_ROLES);
export const vmTypeSchema = z.enum(VM_TYPES);
export const powerActionSchema = z.enum(POWER_ACTIONS);
export const rrdTimeframeSchema = z.enum(RRD_TIMEFRAMES);
export const reportTypeSchema = z.enum(REPORT_TYPES);
export const reportFormatSchema = z.enum(REPORT_FORMATS);

export const createNodeSchema = z.object({
  name: z.string().min(1).max(100),
  pveNodeName: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(8006),
  apiTokenId: z.string().min(3).max(255),
  apiTokenSecret: z.string().min(1),
  verifyTls: z.boolean().default(false),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().default(true),
});

export const updateNodeSchema = createNodeSchema.partial();

export const testNodeConnectionSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(8006),
  pveNodeName: z.string().min(1).max(100),
  apiTokenId: z.string().min(3).max(255),
  apiTokenSecret: z.string().min(1),
  verifyTls: z.boolean().default(false),
});

export const cloneVmSchema = z.object({
  templateVmid: z.number().int().positive(),
  newVmid: z.number().int().min(100).max(999999999),
  name: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/),
  targetStorage: z.string().min(1).optional(),
  cores: z.number().int().min(1).max(128).optional(),
  memoryMb: z.number().int().min(128).optional(),
  diskSizeGb: z.number().int().min(1).optional(),
  cloudInitUser: z.string().min(1).optional(),
  cloudInitPassword: z.string().min(1).optional(),
  cloudInitSshKeys: z.string().optional(),
  ipConfig: z.string().optional(),
  startAfterCreate: z.boolean().default(true),
});

export const createIsoVmSchema = z.object({
  vmid: z.number().int().min(100).max(999999999),
  name: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/),
  isoStorage: z.string().min(1),
  isoFile: z.string().min(1),
  diskStorage: z.string().min(1),
  diskSizeGb: z.number().int().min(1),
  cores: z.number().int().min(1).max(128),
  memoryMb: z.number().int().min(128),
  bridge: z.string().min(1).default('vmbr0'),
  osType: z.string().default('l26'),
  startAfterCreate: z.boolean().default(false),
});

export const createLxcSchema = z.object({
  vmid: z.number().int().min(100).max(999999999),
  hostname: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/),
  osTemplate: z.string().min(1),
  rootStorage: z.string().min(1),
  diskSizeGb: z.number().int().min(1),
  cores: z.number().int().min(1).max(128),
  memoryMb: z.number().int().min(64),
  swapMb: z.number().int().min(0).default(512),
  bridge: z.string().min(1).default('vmbr0'),
  password: z.string().min(5).optional(),
  sshPublicKeys: z.string().optional(),
  ipConfig: z.string().default('ip=dhcp'),
  unprivileged: z.boolean().default(true),
  startAfterCreate: z.boolean().default(true),
});

export const powerActionBodySchema = z.object({
  action: powerActionSchema,
});

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
  isActive: z.boolean().optional(),
});

export const batchAssignmentsSchema = z.object({
  assignments: z.array(
    z.object({
      nodeId: z.string().uuid(),
      vmid: z.number().int().positive(),
      vmType: vmTypeSchema,
      vmNameCache: z.string().max(255).optional(),
    })
  ),
});

export const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const reportExportQuerySchema = z.object({
  type: reportTypeSchema,
  format: reportFormatSchema,
  from: z.string().optional(),
  to: z.string().optional(),
});
