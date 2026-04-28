import type {
  TLeaveList,
  TLeaveItem,
  TLeaveStats,
  TLeaveStatus,
  TLeaveRequest,
  TLeaveConflict,
  TLeaveTypeList,
  TLeaveValidation,
  TLeaveEligibility,
  TLeaveStudyDetails,
} from "#types/leave-managementTypes.ts";
import {
  getLeaveQueryScheme,
  postLeaveBodyScheme,
  putLeaveTypeBodyScheme,
  postLeaveTypeBodyScheme,
  leaveApprovalParamsScheme,
  getLeavePendingQueryScheme,
  getLeaveCalendarQueryScheme,
  postLeaveValidateBodyScheme,
  getLeaveConflictsQueryScheme,
  patchLeaveApprovalBodyScheme,
  getLeaveEligibilityQueryScheme,
} from "#schemas/leave.schemas.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import type { TResponseType } from "#types/responseType.ts";
import type { LeaveStatus } from "../../generated/prisma/enums.ts";
import { getIdParamScheme, getPaginQueryScheme } from "#schemas/schemas.ts";

const VALID_STATUSES: LeaveStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

const calcTotalDays = (start: string | Date, end: string | Date) =>
  Math.ceil((toDate(end).getTime() - toDate(start).getTime()) / 86_400_000) + 1;

const yearBounds = (year: number) => ({
  gte: new Date(year, 0, 1),
  lt: new Date(year + 1, 0, 1),
});

// ─── Shared enrichment ────────────────────────────────────────────────────────

type StaffRow = {
  id: string;
  firstName: string;
  lastName: string;
  staffNo: string;
  departmentId: string | null;
};

const buildLeaveItem = (
  leave: TLeaveRequest,
  staffMap: Map<string, StaffRow>,
  deptMap: Map<string, { id: string; name: string }>,
  ltMap: Map<string, { id: string; name: string }>,
): TLeaveItem => {
  const staff = staffMap.get(leave.staffId);
  const dept = staff?.departmentId ? deptMap.get(staff.departmentId) : null;
  return {
    id: leave.id,
    status: leave.status,
    reason: leave.reason,
    startDate: leave.startDate,
    endDate: leave.endDate,
    totalDays: leave.totalDays,
    duration: `${leave.startDate} → ${leave.endDate}`,
    leaveType: ltMap.get(leave.leaveTypeId)?.name ?? "UNKNOWN",
    studyLeaveDetails: leave.studyLeaveDetails ?? null,
    staff: staff
      ? {
          id: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          staffNo: staff.staffNo,
          department: dept?.name ?? null,
        }
      : null,
  };
};

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // ── 1. List Leaves ───────────────────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getLeaveQueryScheme> }>(
    "/leaves",
    {
      preHandler: authenticate,
      schema: { querystring: getLeaveQueryScheme },
    },
    async (req, reply) => {
      const {
        type,
        search,
        status,
        fromDate,
        page = 1,
        limit = 20,
        toDate: toDateStr,
      } = req.query;
      const skip = (page - 1) * limit;

      // Resolve search to staffIds at DB level — was silently broken before
      const matchingStaffIds = search
        ? (
            await prisma.staff.findMany({
              where: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { staffNo: { contains: search, mode: "insensitive" } },
                ],
              },
              select: { id: true },
            })
          ).map((s) => s.id)
        : undefined;

      const where = {
        ...(matchingStaffIds && { staffId: { in: matchingStaffIds } }),
        ...(type && { leaveTypeId: type }),
        ...(status && { status: status as TLeaveStatus }),
        ...((fromDate || toDateStr) && {
          startDate: { ...(fromDate && { gte: new Date(fromDate) }) },
          endDate: { ...(toDateStr && { lte: new Date(toDateStr) }) },
        }),
      };

      const [leaves, total, staffs, departments, leaveTypes] =
        await prisma.$transaction([
          prisma.leave.findMany({
            where,
            skip,
            take: limit,
            orderBy: { appliedAt: "desc" },
          }),
          prisma.leave.count({ where }),
          prisma.staff.findMany({
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffNo: true,
              departmentId: true,
            },
          }),
          prisma.department.findMany({ select: { id: true, name: true } }),
          prisma.leaveType.findMany({ select: { id: true, name: true } }),
        ]);

      const staffMap = new Map(staffs.map((s) => [s.id, s]));
      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const ltMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

      return __reply<TResponseType<TLeaveList>>(reply, 200, {
        payload: {
          data: leaves.map((l) =>
            buildLeaveItem(l as TLeaveRequest, staffMap, deptMap, ltMap),
          ),
          pagination: total > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  //
  // Retrieve a paginated list of Staff leaves history - GET /staffs/leaves
  fastify.get<{
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/leaves/staff",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: getPaginQueryScheme,
      },
    },
    async (req, reply) => {
      const staffId = req.user.sId;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const start = (page - 1) * limit;
      const [data, total, staffs] = await prisma.$transaction([
        prisma.leave.findMany({
          where: { staffId },
          take: limit,
          skip: start,
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { startDate: "desc" },
        }),
        prisma.leave.count({
          where: { staffId },
        }),
        prisma.staff.findMany({
          select: { id: true, rank: true, firstName: true, lastName: true },
        }),
      ]);

      return __reply<TResponseType<TLeaveList>>(reply, 200, {
        payload: {
          data: data.map((l) => ({
            ...l,
            staff: {
              id: l.staff.id,
              staffNo: l.staffId,
              department: l.staff.department?.name || "N/A",
              name: [l.staff.firstName, l.staff.lastName].join(),
            },
            approver:
              staffs
                .filter((s) => s.id === l.approverId)
                .map((s) => ({
                  id: s.id,
                  rank: s.rank,
                  name: [s.firstName, s.lastName].join(" "),
                }))[0] ?? null,
            studyLeaveDetails: l.studyLeaveDetails as TLeaveStudyDetails,
          })),
          pagination: __pagination(page, limit, total, start),
        },
      });
    },
  );

  // ── 2. Pending Leaves ────────────────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getLeavePendingQueryScheme> }>(
    "/leaves/pending",
    {
      preHandler: authorize(["admin"]),
      schema: { querystring: getLeavePendingQueryScheme },
    },
    async (req, reply) => {
      const { departmentId, page = 1, limit = 5 } = req.query;
      const skip = (page - 1) * limit;

      const staffIdFilter = departmentId
        ? (
            await prisma.staff.findMany({
              where: { departmentId },
              select: { id: true },
            })
          ).map((s) => s.id)
        : undefined;

      const where = {
        status: "PENDING" as LeaveStatus,
        ...(staffIdFilter && { staffId: { in: staffIdFilter } }),
      };

      const [leaves, total, staffs, departments, leaveTypes] =
        await prisma.$transaction([
          prisma.leave.findMany({
            where,
            skip,
            take: limit,
            orderBy: { appliedAt: "desc" },
          }),
          prisma.leave.count({ where }),
          prisma.staff.findMany({
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffNo: true,
              departmentId: true,
            },
          }),
          prisma.department.findMany({ select: { id: true, name: true } }),
          prisma.leaveType.findMany({ select: { id: true, name: true } }),
        ]);

      const staffMap = new Map(staffs.map((s) => [s.id, s]));
      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const ltMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

      return __reply<TResponseType<TLeaveList>>(reply, 200, {
        payload: {
          data: leaves.map((l) =>
            buildLeaveItem(l as TLeaveRequest, staffMap, deptMap, ltMap),
          ),
          pagination: total > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // ── 3. Apply for Leave ───────────────────────────────────────────────────
  fastify.post<{ Body: Static<typeof postLeaveBodyScheme> }>(
    "/leaves",
    {
      preHandler: authenticate,
      schema: { body: postLeaveBodyScheme },
    },
    async (req, reply) => {
      const { leaveTypeId, startDate, endDate, reason, studyLeaveDetails } =
        req.body;

      const staffId = req.user.sId;
      try {
        const [staff, leaveType] = await prisma.$transaction([
          prisma.staff.findUnique({
            where: { id: staffId },
            select: { id: true },
          }),
          prisma.leaveType.findUnique({ where: { id: leaveTypeId } }),
        ]);

        if (!staff)
          return errReply(reply, 404, "Not Found", "Staff member not found.");
        if (!leaveType)
          return errReply(reply, 404, "Not Found", "Leave type not found.");

        const totalDays = calcTotalDays(startDate, endDate);
        const currentYear = new Date().getFullYear();

        // Aggregate used balance — no row fetch needed
        const usedAgg = await prisma.leave.aggregate({
          where: {
            staffId,
            leaveTypeId,
            status: "APPROVED",
            startDate: yearBounds(currentYear),
          },
          _sum: { totalDays: true },
        });
        const usedDays = usedAgg._sum.totalDays ?? 0;
        const available = leaveType.allowedDays - usedDays;

        if (totalDays > available) {
          return errReply(
            reply,
            400,
            "Insufficient Balance",
            `Requested ${totalDays} day(s) but only ${available} available.`,
          );
        }

        // Overlap check
        const overlap = await prisma.leave.findFirst({
          where: {
            staffId,
            status: { notIn: ["REJECTED", "CANCELLED"] },
            startDate: { lte: toDate(endDate) },
            endDate: { gte: toDate(startDate) },
          },
          select: { id: true },
        });
        if (overlap) {
          return errReply(
            reply,
            409,
            "Conflict",
            "You already have an active leave request overlapping this period.",
          );
        }

        // Study leave details check
        if (leaveType.name === "Study Leave") {
          if (!studyLeaveDetails) {
            return errReply(
              reply,
              400,
              "Bad Request",
              "Study leave details are required for study leave type.",
            );
          }
        }

        await prisma.leave.create({
          data: {
            id: idGenerator("lv_").toLowerCase(),
            staffId,
            leaveTypeId,
            startDate: toDate(startDate),
            endDate: toDate(endDate),
            totalDays,
            reason: reason ?? null,
            status: "PENDING",
            approverId: null,
            approverComments: null,
            studyLeaveDetails: studyLeaveDetails ?? {},
            respondedAt: null,
            appliedAt: new Date(),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: "Leave request submitted successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to submit leave. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 4. Approve / Reject Leave ────────────────────────────────────────────
  fastify.patch<{
    Params: { id: string; status: string };
    Body: Static<typeof patchLeaveApprovalBodyScheme>;
  }>(
    "/leaves/:id/:status",
    {
      preHandler: authorize(["admin"]),
      schema: {
        body: patchLeaveApprovalBodyScheme,
        params: leaveApprovalParamsScheme,
      },
    },
    async (req, reply) => {
      const { id, status } = req.params;
      const { approvalComment, approverId } = req.body;

      // Original accepted any arbitrary string as status — now validated
      if (!VALID_STATUSES.includes(status as LeaveStatus)) {
        return errReply(
          reply,
          400,
          "Bad Request",
          `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}.`,
        );
      }

      try {
        const existing = await prisma.leave.findUnique({
          where: { id },
          select: { id: true, status: true },
        });

        if (!existing)
          return errReply(reply, 404, "Not Found", "Leave request not found.");

        if (existing.status !== "PENDING") {
          return errReply(
            reply,
            409,
            "Conflict",
            `Leave is already ${existing.status.toLowerCase()} and cannot be reprocessed.`,
          );
        }

        await prisma.leave.update({
          where: { id },
          data: {
            status: status as LeaveStatus,
            approverComments: approvalComment ?? null,
            approverId: approverId ?? null,
            respondedAt: new Date(),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Leave request ${status.toLowerCase()} successfully.`,
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to process leave. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 5. Delete Leave ──────────────────────────────────────────────────────
  fastify.delete<{ Params: Static<typeof getIdParamScheme> }>(
    "/leaves/:id",
    { preHandler: authorize(["admin"]), schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const existing = await prisma.leave.findUnique({
          where: { id },
          select: { id: true, status: true },
        });

        if (!existing)
          return errReply(reply, 404, "Not Found", "Leave request not found.");

        if (existing.status === "APPROVED") {
          return errReply(
            reply,
            409,
            "Conflict",
            "Approved leave requests cannot be deleted. Reject or cancel it first.",
          );
        }

        await prisma.leave.delete({ where: { id } });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Leave request deleted.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to delete leave. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 6. Validate Leave Application ────────────────────────────────────────
  fastify.post<{ Body: Static<typeof postLeaveValidateBodyScheme> }>(
    "/leaves/validate",
    { preHandler: authenticate, schema: { body: postLeaveValidateBodyScheme } },
    async (req, reply) => {
      const { staffId, leaveTypeId, startDate, endDate } = req.body;

      const errors: string[] = [];
      const warnings: string[] = [];
      const conflicts: string[] = [];

      const start = toDate(startDate);
      const end = toDate(endDate);

      if (start > end) errors.push("End date must be after start date.");
      if (start < new Date()) errors.push("Cannot apply for past dates.");

      const [staff, leaveType] = await prisma.$transaction([
        prisma.staff.findUnique({
          where: { id: staffId },
          select: { id: true, departmentId: true },
        }),
        prisma.leaveType.findUnique({
          where: { id: leaveTypeId },
          select: { id: true, allowedDays: true },
        }),
      ]);

      if (!staff) errors.push("Staff not found.");
      if (!leaveType) errors.push("Invalid leave type.");

      // Only run DB checks if base data is valid
      if (staff && leaveType && errors.length === 0) {
        const totalDays = calcTotalDays(start, end);
        const currentYear = new Date().getFullYear();

        const deptPeerIds = staff.departmentId
          ? (
              await prisma.staff.findMany({
                where: {
                  departmentId: staff.departmentId,
                  NOT: { id: staffId },
                },
                select: { id: true },
              })
            ).map((s) => s.id)
          : [];

        const [usedAgg, overlap, deptConflictCount] = await prisma.$transaction(
          [
            prisma.leave.aggregate({
              where: {
                staffId,
                leaveTypeId,
                status: "APPROVED",
                startDate: yearBounds(currentYear),
              },
              _sum: { totalDays: true },
            }),
            prisma.leave.findFirst({
              where: {
                staffId,
                status: { notIn: ["REJECTED", "CANCELLED"] },
                startDate: { lte: end },
                endDate: { gte: start },
              },
              select: { id: true },
            }),
            prisma.leave.count({
              where: {
                staffId: { in: deptPeerIds },
                status: { in: ["APPROVED", "PENDING"] },
                startDate: { lte: end },
                endDate: { gte: start },
              },
            }),
          ],
        );

        const usedDays = usedAgg._sum.totalDays ?? 0;
        const remaining = leaveType.allowedDays - usedDays;

        if (totalDays > remaining) {
          errors.push(
            `Insufficient balance. Available: ${remaining} day(s), Requested: ${totalDays} day(s).`,
          );
        } else if (remaining < 5) {
          warnings.push(
            `Low leave balance — only ${remaining} day(s) remaining.`,
          );
        }

        if (overlap)
          errors.push(
            "You already have a leave request overlapping this period.",
          );

        if (deptConflictCount > 2) {
          warnings.push(
            `${deptConflictCount} team member(s) are already on leave during this period.`,
          );
        }
      }

      // Original called saveDb() here — read-only endpoint, nothing to save
      return __reply<TResponseType<TLeaveValidation>>(reply, 200, {
        payload: { valid: errors.length === 0, errors, warnings, conflicts },
      });
    },
  );

  // ── 7. Leave Eligibility ─────────────────────────────────────────────────
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getLeaveEligibilityQueryScheme>;
  }>(
    "/leaves/staff/:id/eligible",
    {
      preHandler: authenticate,
      schema: {
        params: getIdParamScheme,
        querystring: getLeaveEligibilityQueryScheme,
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { leaveTypeId } = req.query;

      const [staff, leaveType] = await prisma.$transaction([
        prisma.staff.findUnique({ where: { id }, select: { id: true } }),
        prisma.leaveType.findUnique({ where: { id: leaveTypeId } }),
      ]);

      if (!staff)
        return errReply(reply, 404, "Not Found", "Staff member not found.");
      if (!leaveType)
        return errReply(reply, 404, "Not Found", "Leave type not found.");

      const currentYear = new Date().getFullYear();
      const usedAgg = await prisma.leave.aggregate({
        where: {
          staffId: id,
          leaveTypeId,
          status: "APPROVED",
          startDate: yearBounds(currentYear),
        },
        _sum: { totalDays: true },
      });

      const usedDays = usedAgg._sum.totalDays ?? 0;
      const remainingDays = leaveType.allowedDays - usedDays;

      const eligibility: TLeaveEligibility = {
        eligible: remainingDays > 0,
        remainingDays,
        reason: remainingDays <= 0 ? "No leave balance remaining." : null, // was `undefined`, typed as null
        warnings:
          remainingDays > 0 && remainingDays < 5
            ? ["Low leave balance."]
            : null,
      };

      return __reply<TResponseType<TLeaveEligibility>>(reply, 200, {
        payload: eligibility,
      });
    },
  );

  // ── 8. Leave Conflicts ───────────────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getLeaveConflictsQueryScheme> }>(
    "/leaves/conflicts",
    {
      preHandler: authenticate,
      schema: { querystring: getLeaveConflictsQueryScheme },
    },
    async (req, reply) => {
      const { departmentId, startDate, endDate } = req.query;

      if (!departmentId || !startDate || !endDate) {
        return errReply(
          reply,
          400,
          "Bad Request",
          "departmentId, startDate and endDate are required.",
        );
      }

      const deptStaffIds = (
        await prisma.staff.findMany({
          where: { departmentId },
          select: { id: true },
        })
      ).map((s) => s.id);

      const conflicting = await prisma.leave.findMany({
        where: {
          staffId: { in: deptStaffIds },
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { lte: toDate(endDate) },
          endDate: { gte: toDate(startDate) },
        },
        select: {
          staffId: true,
          startDate: true,
          endDate: true,
          leaveTypeId: true,
        },
      });

      if (conflicting.length === 0) {
        return __reply<TResponseType<TLeaveConflict>>(reply, 200, {
          payload: { conflictCount: 0, staffOnLeave: [], details: [] },
        });
      }

      // Only fetch staff/leaveType rows actually involved
      const involvedStaffIds = [...new Set(conflicting.map((l) => l.staffId))];
      const involvedLtIds = [...new Set(conflicting.map((l) => l.leaveTypeId))];

      const [staffs, leaveTypes] = await prisma.$transaction([
        prisma.staff.findMany({
          where: { id: { in: involvedStaffIds } },
          select: { id: true, firstName: true, lastName: true },
        }),
        prisma.leaveType.findMany({
          where: { id: { in: involvedLtIds } },
          select: { id: true, name: true },
        }),
      ]);

      const staffMap = new Map(staffs.map((s) => [s.id, s]));
      const ltMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

      const conflict: TLeaveConflict = {
        conflictCount: conflicting.length,
        staffOnLeave: staffs.map((s) => `${s.firstName} ${s.lastName}`),
        details: conflicting.map((l) => {
          const s = staffMap.get(l.staffId);
          return {
            staffId: l.staffId,
            name: s ? `${s.firstName} ${s.lastName}` : "Unknown",
            leaveType: ltMap.get(l.leaveTypeId)?.name ?? "Unknown",
            dates: new Date(l.startDate), // TLeaveConflict.details.dates is Date — original stored a string template
          };
        }),
      };

      return __reply<TResponseType<TLeaveConflict>>(reply, 200, {
        payload: conflict,
      });
    },
  );

  // ── 9. Department Leave Calendar ─────────────────────────────────────────
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getLeaveCalendarQueryScheme>;
  }>(
    "/leaves/departments/:id/calendar",
    {
      preHandler: authenticate,
      schema: {
        params: getIdParamScheme,
        querystring: getLeaveCalendarQueryScheme,
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { month, year } = req.query;

      const deptStaff = await prisma.staff.findMany({
        where: { departmentId: id },
        select: { id: true, firstName: true, lastName: true },
      });

      // Push month/year filter to DB — original filtered all leaves in memory
      const dateFilter =
        month && year
          ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
          : undefined;

      const leaves = await prisma.leave.findMany({
        where: {
          staffId: { in: deptStaff.map((s) => s.id) },
          status: { in: ["APPROVED", "PENDING"] },
          ...(dateFilter && { startDate: dateFilter }),
        },
        select: {
          staffId: true,
          startDate: true,
          leaveTypeId: true,
          totalDays: true,
          status: true,
        },
      });

      const involvedLtIds = [...new Set(leaves.map((l) => l.leaveTypeId))];
      const leaveTypes = await prisma.leaveType.findMany({
        where: { id: { in: involvedLtIds } },
        select: { id: true, name: true },
      });

      const staffMap = new Map(deptStaff.map((s) => [s.id, s]));
      const ltMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

      const calendar = leaves.map((leave) => {
        const s = staffMap.get(leave.staffId);
        return {
          date: leave.startDate,
          staffId: leave.staffId,
          staffName: s ? `${s.firstName} ${s.lastName}` : "Unknown",
          leaveType: ltMap.get(leave.leaveTypeId)?.name ?? "Unknown",
          totalDays: leave.totalDays,
          status: leave.status,
        };
      });

      return __reply<TResponseType<typeof calendar>>(reply, 200, {
        payload: calendar,
      });
    },
  );

  // ── 10. Leave Stats ──────────────────────────────────────────────────────
  fastify.get(
    "/leaves/stats",
    { preHandler: authenticate },
    async (_req, reply) => {
      // groupBy at DB — original fetched all rows and used reduceRight with outer mutation
      const groups = await prisma.leave.groupBy({
        by: ["status"],
        _count: { status: true },
      });

      const by = Object.fromEntries(
        groups.map((g) => [g.status, g._count.status]),
      );

      const stats: TLeaveStats = {
        total: groups.reduce((s, g) => s + g._count.status, 0),
        approved: by["APPROVED"] ?? 0,
        rejected: by["REJECTED"] ?? 0,
        pending: by["PENDING"] ?? 0,
      };

      return __reply<TResponseType<TLeaveStats>>(reply, 200, {
        payload: stats,
      });
    },
  );

  // ───────────────────────── LEAVE TYPES ───────────────────────────────────

  // ── 11. List Leave Types ─────────────────────────────────────────────────
  fastify.get(
    "/leaves/types",
    { preHandler: authenticate },
    async (_req, reply) => {
      const leaveTypes = await prisma.leaveType.findMany({
        orderBy: { name: "asc" },
      });
      return __reply<TResponseType<TLeaveTypeList>>(reply, 200, {
        payload: leaveTypes,
      });
    },
  );

  // ── 12. Create Leave Type ────────────────────────────────────────────────
  fastify.post<{ Body: Static<typeof postLeaveTypeBodyScheme> }>(
    "/leaves/types",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postLeaveTypeBodyScheme },
    },
    async (req, reply) => {
      const {
        name,
        allowedDays,
        carryForward = false,
        maxCarryForward = 0,
        paidLeave = false,
      } = req.body;

      try {
        const exists = await prisma.leaveType.findFirst({
          where: { name: { equals: name.trim(), mode: "insensitive" } },
          select: { id: true },
        });
        if (exists)
          return errReply(
            reply,
            409,
            "Conflict",
            `A leave type named '${name}' already exists.`,
          );

        await prisma.leaveType.create({
          data: {
            id: idGenerator("lt_").toLowerCase(),
            name: name.trim(),
            allowedDays,
            carryForward,
            maxCarryForward,
            paidLeave,
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: "Leave type created successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to create leave type. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 13. Update Leave Type ────────────────────────────────────────────────
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putLeaveTypeBodyScheme>;
  }>(
    "/leaves/types/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { params: getIdParamScheme, body: putLeaveTypeBodyScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const {
        name,
        paidLeave,
        allowedDays,
        carryForward = false,
        maxCarryForward = 0,
      } = req.body;

      try {
        const [existing, nameTaken] = await prisma.$transaction([
          prisma.leaveType.findUnique({ where: { id }, select: { id: true } }),
          // Exclude self from name-collision check
          prisma.leaveType.findFirst({
            where: {
              name: { equals: name.trim(), mode: "insensitive" },
              NOT: { id },
            },
            select: { id: true },
          }),
        ]);

        if (!existing)
          return errReply(reply, 404, "Not Found", "Leave type not found.");
        if (nameTaken)
          return errReply(
            reply,
            409,
            "Conflict",
            `A leave type named '${name}' already exists.`,
          );

        await prisma.leaveType.update({
          where: { id },
          data: {
            name: name.trim(),
            allowedDays,
            carryForward,
            maxCarryForward,
            ...(paidLeave !== undefined && { paidLeave }),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Leave type updated successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to update leave type. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 15. Delete Leave Type ────────────────────────────────────────────────
  fastify.delete<{ Params: Static<typeof getIdParamScheme> }>(
    "/leaves/types/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const existing = await prisma.leaveType.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Leave type not found.");

        // Guard — don't orphan active leave requests
        const activeCount = await prisma.leave.count({
          where: { leaveTypeId: id, status: { in: ["PENDING", "APPROVED"] } },
        });
        if (activeCount > 0) {
          return errReply(
            reply,
            409,
            "Conflict",
            `Cannot delete — ${activeCount} active leave request(s) reference this type.`,
          );
        }

        await prisma.leaveType.delete({ where: { id } });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Leave type deleted.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to delete leave type. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );
});
