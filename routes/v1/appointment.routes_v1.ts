import { getAppointmentQueryScheme } from "#schemas/appointment.schemas.ts";
import type { TAppointmentsList } from "#types/appointmentTypes.ts";
import type { TResponseType } from "#types/responseType.ts";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { Static } from "@sinclair/typebox";
import fastifyPlugin from "fastify-plugin";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // Get All Appointments
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
});
