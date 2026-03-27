import {
  getAppointmentQueryScheme,
  postAppointmentBodyScheme,
  putAppointmentBodyScheme,
} from "#schemas/appointment.schemas.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import type { TResponseType } from "#types/responseType.ts";
import type { TAppointmentsList } from "#types/appointmentTypes.ts";
import { __pagination, __reply, idGenerator } from "#utils/utils_helper.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // Get a Paginated list of Appointments - GET /settings/appointments
  fastify.get<{
    Querystring: Static<typeof getAppointmentQueryScheme>;
  }>(
    "/settings/appointments",
    {
      preHandler: authenticate,
      schema: { querystring: getAppointmentQueryScheme },
    },
    async (req, reply) => {
      const { active, limit = 5, page = 1 } = req.query;

      const where = {
        ...(active && { isActive: active }),
      };

      const skip = (page - 1) * limit;

      const [appointments, total] = await prisma.$transaction([
        prisma.natureOfAppointment.findMany({
          where,
          skip,
          take: limit,
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
      preHandler: authorize(["admin"]),
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
        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: false,
          message: `Failed to create appointment "${req.body.name}". ${err.message}`,
        });
      }
    },
  );

  // Update Appointment
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/appointments/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { params: getIdParamScheme, body: putAppointmentBodyScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const targetAppt = await prisma.natureOfAppointment.findUnique({
          where: { id },
        });

        if (!targetAppt) {
          return __reply<TResponseType<boolean>>(reply, 400, {
            payload: false,
            message: `Could not proceed, appointment "${id}" does not exist.`,
          });
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
        return __reply<TResponseType<boolean>>(reply, 400, {
          payload: false,
          message: `Failed to update appointment "${id}". ${err.message}`,
        });
      }
    },
  );
});
