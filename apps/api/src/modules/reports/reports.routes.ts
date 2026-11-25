import type { FastifyInstance } from 'fastify';
import { and, desc, gte, lte } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import { reportExportQuerySchema } from 'shared';
import {
  activityLogs,
  db,
  operatorVpsAssignments,
  proxmoxNodes,
  users,
} from '../../db/index.js';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { recordActivityLog } from '../../services/audit.service.js';

const PDF_FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/export',
    { preHandler: [requireRole('super_admin', 'admin', 'audit')] },
    async (request, reply) => {
      const parsed = reportExportQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const { type, format, from, to } = parsed.data;
      let headers: string[] = [];
      let rows: Array<Array<string | number>> = [];

      if (type === 'inventory') {
        const nodes = await db.select().from(proxmoxNodes);
        headers = ['Node ID', 'Name', 'PVE Node', 'Host', 'Port', 'Enabled'];
        rows = nodes.map((n) => [
          n.id,
          n.name,
          n.pveNodeName,
          n.host,
          n.port,
          n.isEnabled ? 'Yes' : 'No',
        ]);
      } else if (type === 'allocation') {
        const [assignments, allUsers, allNodes] = await Promise.all([
          db.select().from(operatorVpsAssignments),
          db.select().from(users),
          db.select().from(proxmoxNodes),
        ]);
        const userMap = new Map(allUsers.map((u) => [u.id, u.email]));
        const nodeMap = new Map(allNodes.map((n) => [n.id, n.name]));
        headers = ['Operator Email', 'Node', 'VMID', 'Type', 'VM Name', 'Assigned At'];
        rows = assignments.map((a) => [
          userMap.get(a.userId) ?? a.userId,
          nodeMap.get(a.nodeId) ?? a.nodeId,
          a.vmid,
          a.vmType,
          a.vmNameCache ?? '-',
          a.createdAt.toISOString(),
        ]);
      } else {
        const conditions = [];
        if (from) conditions.push(gte(activityLogs.createdAt, new Date(from)));
        if (to) conditions.push(lte(activityLogs.createdAt, new Date(to)));
        const logs = await db
          .select()
          .from(activityLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(activityLogs.createdAt))
          .limit(500);
        headers = ['ID', 'Timestamp', 'User Email', 'Role', 'Action', 'Target', 'Status'];
        rows = logs.map((l) => [
          l.id,
          l.createdAt.toISOString(),
          l.userEmail,
          l.userRole,
          l.action,
          l.targetId ?? '-',
          l.status,
        ]);
      }

      const filename = `proxmox-${type}-report.${format}`;

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'REPORT_EXPORT',
        targetType: 'report',
        targetId: `${type}:${format}`,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      if (format === 'csv') {
        const csvLines = [
          headers.join(','),
          ...rows.map((r) =>
            r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
          ),
        ];
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(csvLines.join('\n'));
      }

      if (format === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(type.toUpperCase());
        sheet.addRow(headers);
        for (const r of rows) {
          sheet.addRow(r);
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return reply
          .header(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(Buffer.from(buffer));
      }

      const PdfPrinterCtor = PdfPrinter as unknown as new (
        fonts: typeof PDF_FONTS
      ) => {
        createPdfKitDocument: (doc: unknown) => NodeJS.ReadableStream & { end: () => void };
      };
      const printer = new PdfPrinterCtor(PDF_FONTS);
      const docDefinition = {
        defaultStyle: { font: 'Helvetica', fontSize: 9 },
        content: [
          { text: `ProxmoxCloud Manager - ${type.toUpperCase()} Report`, fontSize: 14, bold: true, margin: [0, 0, 0, 10] as [number, number, number, number] },
          {
            table: {
              headerRows: 1,
              body: [headers, ...rows.map((r) => r.map(String))],
            },
          },
        ],
      };

      const pdfDoc = await printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve());
        pdfDoc.on('error', (err: Error) => reject(err));
        pdfDoc.end();
      });

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(Buffer.concat(chunks));
    }
  );
}
