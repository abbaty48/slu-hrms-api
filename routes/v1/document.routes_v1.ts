import {
  getDocumentQueryScheme,
  postDocumentBodyScheme,
  getStaffDocumentQueryScheme,
  patchDocumentVerifyBodyScheme,
} from "#schemas/document.schemas.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import type {
  TDocRow,
  TDocumentItem,
  TDocumentList,
  TDocumentStats,
  TStaffDocument,
  TDocumentSummary,
} from "#types/documentTypes.ts";
import fs from "node:fs";
import path from "node:path";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const VALID_CATEGORIES = [
  "Certificates",
  "ID & Photos",
  "Other Documents",
  "Appointment Letters",
] as const;

type TDocumentCategory = (typeof VALID_CATEGORIES)[number];

const MIME_TYPE_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
};

const getFileType = (mimeType: string): string =>
  MIME_TYPE_MAP[mimeType] ?? "FILE";

const toDocStatus = (isVerified: boolean) =>
  isVerified ? "Verified" : "Pending";

const fileExists = (filePath: string) =>
  fs.promises
    .access(filePath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

// ─── Shared formatter ────────────────────────────────────────────────────────
//
const formatDoc = (doc: TDocRow, staffName: string): TDocumentItem => ({
  id: doc.id,
  staffId: doc.staffId,
  staffName,
  year: doc.year,
  title: doc.title,
  degree: doc.degree,
  category: doc.category,
  mimeType: doc.mimeType,
  uploadedAt: doc.createdAt,
  description: doc.description,
  institution: doc.institution,
  fileType: getFileType(doc.mimeType),
  status: toDocStatus(doc.isVerified),
  fileSize: formatFileSize(doc.fileSize),
});

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // ── 1. List All Documents (Admin) ────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getDocumentQueryScheme> }>(
    "/documents",
    {
      preHandler: authorize(["admin"]),
      schema: { querystring: getDocumentQueryScheme },
    },
    async (req, reply) => {
      const { category, status, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = {
        ...(category && { category }),
        ...(status === "Verified" && { isVerified: true }),
        ...(status === "Pending" && { isVerified: false }),
      };

      const [documents, total, staffs] = await prisma.$transaction([
        prisma.document.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            staffId: true,
            title: true,
            category: true,
            mimeType: true,
            fileSize: true,
            isVerified: true,
            createdAt: true,
            description: true,
            degree: true,
            institution: true,
            year: true,
          },
        }),
        prisma.document.count({ where }),
        prisma.staff.findMany({
          select: { id: true, firstName: true, lastName: true },
        }),
      ]);

      const staffMap = new Map(
        staffs.map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
      );

      return __reply<TResponseType<TDocumentList>>(reply, 200, {
        payload: {
          documents: documents.map((d) =>
            formatDoc(d, staffMap.get(d.staffId) ?? "Unknown"),
          ),
          pagination: total > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // ── 2. Get Staff Documents ───────────────────────────────────────────────
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getStaffDocumentQueryScheme>;
  }>(
    "/document/staffs/:id",
    {
      preHandler: authenticate,
      schema: {
        params: getIdParamScheme,
        querystring: getStaffDocumentQueryScheme,
      },
    },
    async (req, reply) => {
      const { id: staffId } = req.params;
      const { category, status } = req.query;

      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!staff)
        return errReply(reply, 404, "Not Found", "Staff member not found.");

      const where = {
        staffId,
        ...(category && { category }),
        ...(status === "Verified" && { isVerified: true }),
        ...(status === "Pending" && { isVerified: false }),
      };

      const documents = await prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          staffId: true,
          title: true,
          category: true,
          mimeType: true,
          fileSize: true,
          isVerified: true,
          createdAt: true,
          description: true,
          degree: true,
          institution: true,
          year: true,
        },
      });

      const staffName = `${staff.firstName} ${staff.lastName}`;
      const formatted = documents.map((d) => formatDoc(d, staffName));

      // Single-pass summary — original did 3 separate .filter() scans
      let verified = 0,
        pending = 0;
      const categoryDistribution: Record<string, number> = {};
      for (const doc of formatted) {
        if (doc.status === "Verified") verified++;
        else pending++;
        categoryDistribution[doc.category] =
          (categoryDistribution[doc.category] ?? 0) + 1;
      }

      const summary: TDocumentSummary | null =
        formatted.length > 0
          ? {
              totalDocuments: formatted.length,
              verifiedDocuments: verified,
              pendingDocuments: pending,
              categoryDistribution,
            }
          : null;

      return __reply<TResponseType<TStaffDocument>>(reply, 200, {
        payload: { summary, data: formatted },
      });
    },
  );

  // ── 3. Upload Document ───────────────────────────────────────────────────
  fastify.post<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof postDocumentBodyScheme>;
  }>(
    "/documents/staff/:id",
    {
      preHandler: authenticate,
      schema: { params: getIdParamScheme, body: postDocumentBodyScheme },
    },
    async (req, reply) => {
      const { id: staffId } = req.params;
      const {
        title,
        year,
        degree,
        category,
        fileName,
        fileSize,
        mimeType,
        description,
        institution,
      } = req.body;

      try {
        const staff = await prisma.staff.findUnique({
          where: { id: staffId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (!staff)
          return errReply(reply, 404, "Not Found", "Staff member not found.");

        if (!VALID_CATEGORIES.includes(category as TDocumentCategory)) {
          return errReply(
            reply,
            400,
            "Bad Request",
            `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
          );
        }

        const doc = await prisma.document.create({
          data: {
            id: idGenerator("doc_").toLowerCase(),
            staffId,
            uploadedBy: staffId,
            title: title.trim(),
            category,
            fileName,
            fileSize: fileSize ?? 0,
            mimeType,
            isVerified: false,
            verifiedBy: null,
            description: description ?? null,
            degree: degree ?? null,
            institution: institution ?? null,
            year: year ?? null,
          },
        });

        return __reply<TResponseType<TDocumentItem>>(reply, 201, {
          payload: formatDoc(doc, `${staff.firstName} ${staff.lastName}`),
          message: "Document uploaded successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to upload document. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 4. View Document (metadata or inline stream) ─────────────────────────
  fastify.get<{ Params: Static<typeof getIdParamScheme> }>(
    "/documents/:id/view",
    { preHandler: authenticate, schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;

      const doc = await prisma.document.findUnique({
        where: { id },
        select: {
          id: true,
          staffId: true,
          title: true,
          category: true,
          mimeType: true,
          fileSize: true,
          isVerified: true,
          createdAt: true,
          description: true,
          degree: true,
          institution: true,
          year: true,
          fileName: true,
        },
      });
      if (!doc) return errReply(reply, 404, "Not Found", "Document not found.");

      const staff = await prisma.staff.findUnique({
        where: { id: doc.staffId },
        select: { firstName: true, lastName: true },
      });

      const filePath = path.join(UPLOADS_DIR, doc.fileName);
      const exists = await fileExists(filePath);

      // File on disk — stream it inline
      if (exists) {
        reply.header("Content-Type", doc.mimeType);
        reply.header(
          "Content-Disposition",
          `inline; filename="${doc.fileName}"`,
        );
        return reply.send(fs.createReadStream(filePath));
      }

      // File not on disk — return metadata so client can handle gracefully
      const staffName = staff
        ? `${staff.firstName} ${staff.lastName}`
        : "Unknown";
      return __reply<TResponseType<TDocumentItem>>(reply, 200, {
        payload: formatDoc(doc, staffName),
      });
    },
  );

  // ── 5. Download Document ─────────────────────────────────────────────────
  fastify.get<{ Params: Static<typeof getIdParamScheme> }>(
    "/documents/:id/download",
    { preHandler: authenticate, schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;

      const doc = await prisma.document.findUnique({
        where: { id },
        select: { fileName: true, mimeType: true, fileSize: true },
      });
      if (!doc) return errReply(reply, 404, "Not Found", "Document not found.");

      const filePath = path.join(UPLOADS_DIR, doc.fileName);
      const exists = await fileExists(filePath);

      if (!exists)
        return errReply(reply, 404, "Not Found", "File not found on server.");

      reply.header("Content-Type", doc.mimeType);
      reply.header(
        "Content-Disposition",
        `attachment; filename="${doc.fileName}"`,
      );
      reply.header("Content-Length", doc.fileSize);
      return reply.send(fs.createReadStream(filePath));
    },
  );

  // ── 6. Verify Document ───────────────────────────────────────────────────
  fastify.patch<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof patchDocumentVerifyBodyScheme>;
  }>(
    "/documents/:id/verify",
    {
      preHandler: authorize(["admin"]),
      schema: { params: getIdParamScheme, body: patchDocumentVerifyBodyScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { verifiedBy } = req.body;

      try {
        const existing = await prisma.document.findUnique({
          where: { id },
          select: { id: true, isVerified: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Document not found.");

        if (existing.isVerified) {
          return errReply(
            reply,
            409,
            "Conflict",
            "Document is already verified.",
          );
        }

        await prisma.document.update({
          where: { id },
          data: { isVerified: true, verifiedBy },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Document verified successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to verify document. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 7. Delete Document ───────────────────────────────────────────────────
  fastify.delete<{ Params: Static<typeof getIdParamScheme> }>(
    "/documents/:id",
    { preHandler: authorize(["admin"]), schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const existing = await prisma.document.findUnique({
          where: { id },
          select: { id: true, fileName: true, isVerified: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Document not found.");

        if (existing.isVerified) {
          return errReply(
            reply,
            409,
            "Conflict",
            "Verified documents cannot be deleted. Un-verify it first.",
          );
        }

        await prisma.document.delete({ where: { id } });

        // Best-effort file removal — don't fail the request if file is already gone
        const filePath = path.join(UPLOADS_DIR, existing.fileName);
        if (await fileExists(filePath)) {
          await fs.promises.unlink(filePath).catch(() => null);
        }

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Document deleted.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to delete document. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 8. Document Stats ────────────────────────────────────────────────────
  fastify.get(
    "/documents/stats",
    { preHandler: authorize(["admin"]) },
    async (_req, reply) => {
      const [statusGroups, categoryGroups] = await prisma.$transaction([
        prisma.document.groupBy({
          by: ["isVerified"],
          _count: { _all: true },
          orderBy: {},
        }),
        prisma.document.groupBy({
          by: ["category"],
          _count: { _all: true },
          orderBy: {},
        }),
      ]);

      const verified = statusGroups.find((g) => g.isVerified)?._count._all ?? 0;
      const pending = statusGroups.find((g) => !g.isVerified)?._count._all ?? 0;

      const stats: TDocumentStats = {
        total: verified + pending,
        verified,
        pending,
        byCategory: Object.fromEntries(
          categoryGroups.map((g) => [g.category, g._count._all]),
        ),
      };

      return __reply<TResponseType<TDocumentStats>>(reply, 200, {
        payload: stats,
      });
    },
  );
});
