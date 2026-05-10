import {
  getAppointmentQueryScheme,
  postAppointmentBodyScheme,
  putAppointmentBodyScheme,
} from "#schemas/appointment.schemas.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TAppointmentsList } from "#types/appointmentTypes.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authorize } = fastify;

  // Get a Paginated list of Appointments - GET /settings/appointments
  fastify.get<{
    Querystring: Static<typeof getAppointmentQueryScheme>;
  }>(
    "/settings/appointments",
    {
      preHandler: authorize([AuthUserRole.HR_ADMIN, AuthUserRole.DEPT_ADMIN]),
      schema: { querystring: getAppointmentQueryScheme },
    },
    async (req, reply) => {
      const { active, limit = 5, page = 1, q } = req.query;

      const where = {
        ...(active && { isActive: active }),
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      };

      const skip = (page - 1) * limit;

      const [appointments, total] = await prisma.$transaction([
        prisma.natureOfAppointment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.natureOfAppointment.count({ where }),
      ]);

      return __reply<TResponseType<TAppointmentsList>>(reply, 200, {
        payload: {
          data: appointments,
          pagination:
            appointments.length > 0
              ? __pagination(page, limit, total, skip)
              : null,
        },
      });
    },
  );

  // Create Appointment - POST /settings/appointments
  fastify.post<{
    Body: Static<typeof postAppointmentBodyScheme>;
  }>(
    "/settings/appointments",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { body: postAppointmentBodyScheme },
    },
    async (req, reply) => {
      const data = req.body;
      try {
        await prisma.natureOfAppointment.create({
          data: {
            id: idGenerator("appt_"),
            ...data,
          },
        });
        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `Appointment "${req.body.name}" is created.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          500,
          "Failed to create.",
          `Failed to create appointment "${req.body.name}". ${err.message}`,
        );
      }
    },
  );

  // Update Appointment
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/appointments/:id",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme, body: putAppointmentBodyScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const targetAppt = await prisma.natureOfAppointment.findUnique({
          where: { id },
        });

        if (!targetAppt) {
          return errReply(
            reply,
            400,
            "Update aborted",
            `Could not proceed, appointment "${id}" does not exist.`,
          );
        }

        const data = Object.assign({ ...targetAppt }, req.body);

        await prisma.natureOfAppointment.update({
          where: { id },
          data,
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Appointment "${data.name}" is updated.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to update",
          `Failed to update appointment "${id}". ${err.message}`,
        );
      }
    },
  );

  // Delete Appointment
  fastify.delete<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/appointments/:id",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const targetAppt = await prisma.natureOfAppointment.findUnique({
          where: { id },
        });

        if (!targetAppt) {
          return errReply(
            reply,
            400,
            "Delete aborted",
            `Could not proceed, appointment "${id}" does not exist.`,
          );
        }

        await prisma.natureOfAppointment.delete({
          where: { id },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Appointment "${targetAppt.name}" is deleted.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          500,
          "Could not delete.",
          `Failed to delete appointment "${id}". ${err.message}`,
        );
      }
    },
  );
});
