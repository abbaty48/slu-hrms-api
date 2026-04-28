import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import type {
  TDepartment,
  TDepartmentsList,
  TDepartmentSummary,
  TDepartmentNameList,
} from "#types/departmentTypes.ts";
import {
  putDepartmentBodySchema,
  postDepartmentBodySchema,
  getDepartmentPaginQuerySchema,
} from "#schemas/department.schemas.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  fastify.get<{
    Querystring: Static<typeof getDepartmentPaginQuerySchema>;
  }>(
    "/departments",
    {
      preHandler: authenticate,
    },
    async (_, reply) => {
      const departments = (await prisma.department.findMany({})).map((dept) => {
        return {
          id: dept.id,
          name: dept.name,
        };
      });

      return __reply<TResponseType<TDepartmentNameList>>(reply, 200, {
        payload: departments,
      });
    },
  );

  // Department summary
  fastify.get(
    "/departments/summary",
    { preHandler: authenticate },
    async (_req, reply) => {
      const [departments, staffs] = await prisma.$transaction([
        prisma.department.findMany(),
        prisma.staff.findMany(),
      ]);

      const summary = departments.map((dept) => {
        const deptStaff = staffs.filter((s) => s.departmentId === dept.id);

        return {
          departmentId: dept.id,
          departmentName: dept.name,
          staffCount: deptStaff.length,
          teachingStaff: deptStaff.filter((s) => s.cadre === "Teaching").length,
          nonTeachingStaff: deptStaff.filter((s) => s.cadre === "Non_Teaching")
            .length,
          seniorStaff: deptStaff.filter((s) => s.staffCategory === "Senior")
            .length,
          juniorStaff: deptStaff.filter((s) => s.staffCategory === "Junior")
            .length,
        };
      });

      return __reply<TResponseType<TDepartmentSummary[]>>(reply, 200, {
        payload: summary,
      });
    },
  );

  // Get All Departments
  fastify.get<{
    Querystring: Static<typeof getDepartmentPaginQuerySchema>;
  }>(
    "/settings/departments",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { querystring: getDepartmentPaginQuerySchema },
    },
    async (req, reply) => {
      const { active, page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;
      const where = {
        ...(active !== undefined && { isActive: active }),
      };
      const [departments, total, staffs] = await prisma.$transaction([
        prisma.department.findMany({ where, skip, take: limit }),
        prisma.department.count({ where }),
        prisma.staff.findMany(),
      ]);

      let depts = departments.map((dept) => {
        const staffCount = staffs.filter(
          (s) => s.departmentId === dept.id,
        ).length;
        return {
          ...dept,
          staffCount,
        };
      });

      return __reply<TResponseType<TDepartmentsList>>(reply, 200, {
        payload: {
          data: depts,
          pagination:
            depts.length > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // Get Single Department
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/departments/:id",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const [department, staffCount] = await prisma.$transaction([
        prisma.department.findUnique({ where: { id } }),
        prisma.staff.count({ where: { departmentId: id } }),
      ]);

      if (!department) {
        return __reply<TResponseType<TDepartment | null>>(reply, 200, {
          payload: null,
          message: `Department not found`,
        });
      }

      return __reply<TResponseType<TDepartment>>(reply, 200, {
        payload: {
          ...department,
          staffCount,
        },
      });
    },
  );

  // Create Department
  fastify.post<{
    Body: Static<typeof postDepartmentBodySchema>;
  }>(
    "/settings/departments",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { body: postDepartmentBodySchema },
    },
    async (req, reply) => {
      const { code, ...data } = req.body;

      const exists = await prisma.department.findFirst({
        where: {
          code: { equals: code, mode: "insensitive" },
        },
      });

      if (exists) {
        return errReply(
          reply,
          400,
          "Aborted",
          `Could not proceed, the ${code} already exists.`,
        );
      }

      try {
        await prisma.department.create({
          data: {
            ...data,
            code,
            id: idGenerator("dept_"),
          },
        });
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Department with the "${code}" created.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to create",
          `Failed, something went wrong, ${err.message}`,
        );
      }
    },
  );

  // Update Department
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putDepartmentBodySchema>;
  }>(
    "/settings/departments/:id",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme, body: putDepartmentBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { code, ...updates } = req.body;

      try {
        const target = await prisma.department.findFirst({
          where: { id },
        });

        if (!target) {
          return errReply(
            reply,
            400,
            "Aborted ",
            `Could not proceed, the ${id} does not exists.`,
          );
        }

        if (code) {
          const hasIt = await prisma.department.findFirst({
            where: { AND: [{ code }, { NOT: { id } }] },
          });
          if (hasIt) {
            return errReply(
              reply,
              400,
              "Aborted",
              `Could not proceed, the ${target.code} already exists.`,
            );
          }
        }

        const data = Object.assign({ ...target }, { ...updates });
        await prisma.department.update({
          where: { id },
          data: {
            ...data,
            code: code ?? target?.code,
          },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Department "${target.code}" is updated.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to create",
          `Failed, something went wrong, ${err.message}`,
        );
      }
    },
  );

  // Delete Department
  fastify.delete<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/departments/:id",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const [target, numOfStaff] = await prisma.$transaction([
          prisma.department.findFirst({
            where: { id },
          }),
          prisma.staff.count({ where: { departmentId: id } }),
        ]);

        if (!target) {
          return errReply(
            reply,
            400,
            "Aborted",
            `Could not proceed, the "${id}" does not exists.`,
          );
        }

        // Check if department has staff
        if (numOfStaff) {
          return errReply(
            reply,
            400,
            "Aborted",
            `Could not proceed, the department has active staff members.`,
          );
        }
        await prisma.department.delete({ where: { id } });

        return __reply<TResponseType<boolean>>(reply, 204, {
          payload: true,
          message: `Department "${id}" is deleted.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to create",
          `Failed, something went wrong, ${err.message}`,
        );
      }
    },
  );
});
