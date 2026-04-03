import type {
  Theme,
  DateFormat,
  FiscalYearMonth,
} from "../../generated/prisma/enums.ts";
import fastifyPlugin from "fastify-plugin";
import { Type, type Static } from "@sinclair/typebox";
import { __reply, errReply } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TSystemPreferences } from "#types/settingsTypes.ts";

const defaultPreference = {
  id: "sys_pref_1",
  institutionName: "Sule Lamido University",
  institutionAbbreviation: "SLU",
  dateFormat: "DD_MM_YYYY" as DateFormat,
  fiscalYearStart: "January" as FiscalYearMonth,
  leaveApprovalLevels: 2,
  emailNotifications: true,
  smsNotifications: false,
  theme: "system" as Theme,
  language: "en",
  timezone: "Africa/Lagos",
  updatedBy: "internal_api",
  updatedAt: new Date(),
};

export default fastifyPlugin((fastify) => {
  const { prisma, authorize } = fastify;

  // Get System Preferences
  fastify.get(
    "/settings/preferences",
    {
      preHandler: authorize(["admin"]),
    },
    async (_req, reply) => {
      // Get or create default preferences
      let preferences = await prisma.systemPreferences.findFirst();

      if (!preferences) {
        preferences = await prisma.systemPreferences.create({
          data: defaultPreference,
        });
      }

      return __reply<TResponseType<TSystemPreferences>>(reply, 200, {
        payload: {
          ...preferences,
          dateFormat: preferences.dateFormat as any,
          updatedAt: preferences.updatedAt.toISOString(),
        },
      });
    },
  );

  // Update System Preferences
  const patchSystemPreferenceSchema = Type.Object({
    institutionName: Type.Optional(Type.String()),
    institutionAbbreviation: Type.Optional(Type.String()),
    dateFormat: Type.Optional(Type.String()),
    fiscalYearStart: Type.Optional(
      Type.Union([
        Type.Literal("January"),
        Type.Literal("February"),
        Type.Literal("March"),
        Type.Literal("April"),
        Type.Literal("May"),
        Type.Literal("June"),
        Type.Literal("July"),
        Type.Literal("August"),
        Type.Literal("September"),
        Type.Literal("October"),
        Type.Literal("November"),
        Type.Literal("December"),
      ]),
    ),
    leaveApprovalLevels: Type.Optional(Type.Number()),
    emailNotifications: Type.Optional(Type.Boolean()),
    smsNotifications: Type.Optional(Type.Boolean()),
    theme: Type.Optional(
      Type.Union([
        Type.Literal("light"),
        Type.Literal("dark"),
        Type.Literal("system"),
      ]),
    ),
    language: Type.Optional(Type.String()),
    timezone: Type.Optional(Type.String()),
  });
  fastify.patch<{
    Body: Static<typeof patchSystemPreferenceSchema>;
  }>(
    "/settings/preferences",
    {
      preHandler: authorize(["admin"]),
      schema: { body: patchSystemPreferenceSchema },
    },
    async (req, reply) => {
      const updates = req.body;
      let preferences = await prisma.systemPreferences.findFirst();

      // Update preferences
      const upsert = Object.assign(preferences ?? defaultPreference, {
        ...updates,
        dateFormat: (updates.dateFormat as DateFormat) ?? "YYYY_MM_DD",
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.sub,
      });

      try {
        await prisma.systemPreferences.upsert({
          create: upsert,
          update: upsert,
          where: { id: defaultPreference.id },
        });

        return __reply<TResponseType<boolean>>(
          reply,
          !preferences ? 201 : 200,
          {
            payload: true,
            message: "System preference upserted.",
          },
        );
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to upsert preference. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );
});
