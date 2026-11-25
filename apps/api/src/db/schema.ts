import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigserial,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin',
  'operator',
  'audit',
  'no_access',
]);

export const vmTypeEnum = pgEnum('vm_type', ['qemu', 'lxc']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').notNull().default('no_access'),
    isProtected: boolean('is_protected').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
  ]
);

export const proxmoxNodes = pgTable(
  'proxmox_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    pveNodeName: varchar('pve_node_name', { length: 100 }).notNull(),
    host: varchar('host', { length: 255 }).notNull(),
    port: integer('port').notNull().default(8006),
    apiTokenId: varchar('api_token_id', { length: 255 }).notNull(),
    apiTokenSecretEnc: text('api_token_secret_enc').notNull(),
    verifyTls: boolean('verify_tls').notNull().default(false),
    description: text('description'),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_proxmox_nodes_host_port_pve').on(
      table.host,
      table.port,
      table.pveNodeName
    ),
  ]
);

export const operatorVpsAssignments = pgTable(
  'operator_vps_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => proxmoxNodes.id, { onDelete: 'cascade' }),
    vmid: integer('vmid').notNull(),
    vmType: vmTypeEnum('vm_type').notNull().default('qemu'),
    vmNameCache: varchar('vm_name_cache', { length: 255 }),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_assignments_user_node_vmid').on(table.userId, table.nodeId, table.vmid),
    index('idx_assignments_user').on(table.userId),
    index('idx_assignments_node_vmid').on(table.nodeId, table.vmid),
  ]
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    userEmail: varchar('user_email', { length: 255 }).notNull(),
    userRole: userRoleEnum('user_role').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: varchar('target_id', { length: 255 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    status: varchar('status', { length: 20 }).notNull().default('success'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_logs_created_at').on(table.createdAt),
    index('idx_logs_action').on(table.action),
    index('idx_logs_user_id').on(table.userId),
  ]
);
