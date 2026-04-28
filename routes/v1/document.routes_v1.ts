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
import {
  mimes,
  type TDocument,
  type TDocumentList,
  type TDocumentStats,
  type TDocumentSummary,
  type TDocumentCategory,
} from "#types/documentTypes.ts";
import path from "node:path";
import fs from "fs/promises";
import fastifyPlugin from "fastify-plugin";
import { pipeline } from "node:stream/promises";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";
import { createWriteStream, createReadStream } from "node:fs";
import type { TStaff, TStaffIdentity } from "#types/staffTypes.ts";
import multipart, { type MultipartFile } from "@fastify/multipart";

// ─── Constants ────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
};

const getFileType = (mimeType: string, fileName?: string): string => {
  return (
    Object.keys(mimes)
      .find((m) => m === mimeType)
      ?.toLowerCase() ??
    fileName?.split(".")[1] ??
    "file"
  );
};

const getFileName = (groupId: string) => {
  // upload_random_0090219021
  return `${groupId}_${Date.now()}`;
};

const getCategory = (mime: string): TDocumentCategory => {
  switch (mime) {
    case "application/pdf": {
      return "Certificates";
    }
    case "image/jpeg":
    case "image/png":
    case "image/gif":
    case "image/webp": {
      return "ID&Photos";
    }
    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      return "AppointmentLetters";
    }
    default:
      return "Others";
  }
};

const fileExists = (filePath: string) =>
  fs
    .access(filePath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // REGISTER MULTIPART FOR FILE UPLOAD
  fastify.register(multipart);
  //
  const getStaffDetail = async (
    staffId: string,
  ): Promise<TStaffIdentity | null> => {
    let staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        department: { select: { name: true } },
        rankDetails: { select: { title: true } },
      },
    });

    if (staff) {
      return Promise.resolve({
        id: staff.id,
        lastName: staff.lastName,
        firstName: staff.firstName,
        rank: staff.rankDetails.title || "N/A",
        department: staff.department?.name || "N/A",
      });
    }
    return Promise.resolve(null);
  };
  const documents = async (where: any, skip: number, limit: number = 5) => {
    const staffDetails = (staff: TStaff | undefined) => {
      if (!staff) return null;

      return {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        department: staff.department?.name || "N/A",
        rank: staff.rank || "N/A",
      };
    };

    const [documents, total, staffs] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.document.count({ where }),
      prisma.staff.findMany({
        include: {
          department: { select: { name: true } },
          rankDetails: { select: { title: true } },
        },
      }),
    ]);

    let docs = documents.map((doc) => ({
      ...doc,
      staff: staffDetails(staffs.find((s) => s.id === doc.staffId) as TStaff),
      verifier: doc.verifiedBy
        ? staffDetails(staffs.find((s) => s.id === doc.verifiedBy) as TStaff)
        : null,
    }));

    return {
      docs,
      total,
    };
  };

  // ── 1. List All Documents (Admin) ────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getDocumentQueryScheme> }>(
    "/documents",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { querystring: getDocumentQueryScheme },
    },
    async (req, reply) => {
      const { category, status, page = 1, limit = 5 } = req.query;
      const skip = (page - 1) * limit;

      const where = {
        ...(category && { category }),
        ...(status && ({ status: "Verified" } as const)),
        ...(status && ({ status: "Pending" } as const)),
      };

      const { docs, total } = await documents(where, skip, limit);
      return __reply<TResponseType<TDocumentList>>(reply, 200, {
        payload: {
          data: docs as TDocument[],
          pagination: total > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // ── 2. Get Staff Documents ───────────────────────────────────────────────
  fastify.get<{
    Querystring: Static<typeof getStaffDocumentQueryScheme>;
  }>(
    "/documents/staffs",
    {
      preHandler: authenticate,
      schema: { querystring: getStaffDocumentQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.user.sId;
      const { category, status, limit = 5, page = 1 } = req.query;
      const skip = (page - 1) * limit;

      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!staff)
        return errReply(reply, 404, "Not Found", "Staff member not found.");

      const where = {
        staffId,
        ...(category && ({ category } as const)),
        ...(status && { status }),
      };

      const { docs, total } = await documents(where, skip, limit);
      // Single-pass summary — original did 3 separate .filter() scans
      let verified = 0,
        pending = 0;
      const categoryDistribution: Record<string, number> = {};
      for (const doc of docs) {
        if (doc.status === "Verified") verified++;
        else pending++;
        categoryDistribution[doc.category] =
          (categoryDistribution[doc.category] ?? 0) + 1;
      }

      return __reply<TResponseType<TDocumentList>>(reply, 200, {
        payload: {
          data: docs as TDocument[],
          pagination:
            docs.length > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // ── 3. Get Staff Document Summary ──────────── GET - /documents/summary
  fastify.get(
    "/documents/summary",
    {
      preHandler: authenticate,
    },
    async (req, reply) => {
      const staffId = req.user.sId;

      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!staff)
        return errReply(reply, 404, "Not Found", "Staff member not found.");

      const { docs } = await documents({ staffId }, 0);
      // Single-pass summary — original did 3 separate .filter() scans
      let verified = 0,
        pending = 0;
      const categoryDistribution: Record<string, number> = {};
      for (const doc of docs) {
        if (doc.status === "Verified") verified++;
        else pending++;
        categoryDistribution[doc.category] =
          (categoryDistribution[doc.category] ?? 0) + 1;
      }

      const summary =
        docs.length > 0
          ? {
              totalDocuments: docs.length,
              totalVerifiedDocuments: verified,
              totalPendingDocuments: pending,
              categoryDistribution: categoryDistribution,
            }
          : null;

      return __reply<TResponseType<TDocumentSummary | null>>(reply, 200, {
        payload: summary,
      });
    },
  );

  // ── 3. Upload Document ───────────────────────────────────────────────────
  // 50MB is a standard, safe limit for typical document uploads
  const FIFTY_MB_IN_BYTES = 50 * 1024 * 1024;

  fastify.post<{
    Body: Static<typeof postDocumentBodyScheme>;
  }>(
    "/documents",
    {
      preHandler: authenticate,
      bodyLimit: FIFTY_MB_IN_BYTES,
    },
    async (req, reply) => {
      const staffId = req.user.sId;
      const fileUploadErrors: string[] = [];

      const uploadedFiles: Array<{
        filePart: any;
        fileName: string;
        fileSize: number;
      }> = [];

      try {
        const staff = await getStaffDetail(staffId);

        if (!staff) {
          return errReply(reply, 404, "Not Found", "Staff member not found.");
        }

        const body = new Map();
        // Generate a single Group ID for this entire batch of uploads
        const groupId = idGenerator("upload_");

        for await (let part of req.parts()) {
          if (part.type === "file") {
            if (!Object.keys(mimes).includes(part.mimetype)) {
              fileUploadErrors.push(
                `File "${part.filename}" was ignored due to unsupported file type.`,
              );
              continue;
            }
            const fileName = getFileName(groupId);
            const uploadDestination = `uploads/${fileName}`;

            await pipeline(part.file, createWriteStream(uploadDestination));

            const stats = await fs.stat(uploadDestination);

            uploadedFiles.push({
              fileName,
              filePart: part,
              fileSize: stats.size,
            });
          } else if (part.type === "field") {
            body.set(part.fieldname, part.value);
          }
        }

        if (uploadedFiles.length === 0) {
          return errReply(
            reply,
            400,
            "Bad Request",
            "No valid files were uploaded.",
          );
        }

        const createdDocuments = await prisma.$transaction(async (tx) => {
          const docs = [];
          for (const uploadedFile of uploadedFiles) {
            const id = idGenerator("doc_");

            const newDoc = await tx.document.create({
              data: {
                id,
                groupId, // Links all files from this specific upload request together
                staffId,
                fileName: uploadedFile.fileName,
                status: "Pending",
                year: body.get("year") ?? "",
                degree: body.get("degree") ?? "",
                category: getCategory(uploadedFile.filePart.mimetype),
                mimeType: getFileType(uploadedFile.filePart.mimetype),
                description: body.get("description") ?? "",
                institution: body.get("institution") ?? "",
                fileSize: formatFileSize(uploadedFile.fileSize),
              },
            });

            docs.push({
              ...newDoc,
              staff,
              verifier: null,
              status: newDoc.status as "Verified" | "Pending",
            });
          }

          return docs;
        });

        return __reply<TResponseType<TDocument[]>>(reply, 201, {
          payload: createdDocuments,
          message: `Successfully uploaded ${createdDocuments.length} document(s).`,
          // errors: fileUploadErrors.length > 0 ? fileUploadErrors : undefined,
          // errors: fileUploadErrors.length > 0 ? fileUploadErrors : undefined,
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to upload documents. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 4. View Document (metadata or inline stream) ─────────────────────────
  /*
  fastify.get<{ Params: Static<typeof getIdParamScheme> }>(
    "/documents/:id/view",
    { preHandler: authenticate, schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;

      const doc = await prisma.document.findUnique({
        where: { id },
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

      return __reply<TResponseType<TDocument>>(reply, 200, {
        payload: formatDoc(doc, null),
      });
    },
  );
  */
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
      return reply.send(createReadStream(filePath));
    },
  );

  // ── 6. Verify Document ───────────────────────────────────────────────────
  fastify.patch<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof patchDocumentVerifyBodyScheme>;
  }>(
    "/documents/:id/verify",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme, body: patchDocumentVerifyBodyScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { verifiedBy } = req.body;

      try {
        const existing = await prisma.document.findUnique({
          where: { id },
          select: { id: true, status: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Document not found.");

        if (existing.status === "Verified") {
          return errReply(
            reply,
            409,
            "Conflict",
            "Document is already verified.",
          );
        }

        await prisma.document.update({
          where: { id },
          data: { status: "Verified", verifiedBy },
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
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const existing = await prisma.document.findUnique({
          where: { id },
          select: { id: true, fileName: true, status: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Document not found.");

        if (existing.status === "Pending") {
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
          await fs.unlink(filePath).catch(() => null);
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
    { preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]) },
    async (_req, reply) => {
      const [statusGroups, categoryGroups] = await prisma.$transaction([
        prisma.document.groupBy({
          by: ["status"],
          _count: { _all: true },
          orderBy: {},
        }),
        prisma.document.groupBy({
          by: ["category"],
          _count: { _all: true },
          orderBy: {},
        }),
      ]);

      const verified =
        statusGroups.find((g) => g.status === "Verified")?._count?._all ?? 0;
      const pending =
        statusGroups.find((g) => g.status === "Pending")?._count?._all ?? 0;

      const stats: TDocumentStats = {
        total: verified + pending,
        verified,
        pending,
        byCategory: Object.fromEntries(
          categoryGroups.map((g) => [g.category, g?._count?._all ?? 0]),
        ),
      };

      return __reply<TResponseType<TDocumentStats>>(reply, 200, {
        payload: stats,
      });
    },
  );
});
