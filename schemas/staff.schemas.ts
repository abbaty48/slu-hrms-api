import { Type } from "@sinclair/typebox";

export const getStaffAttendanceSummaryPaginQueryScheme = Type.Object({
  year: Type.Optional(Type.Number()),
  month: Type.Optional(Type.Number()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const getStaffPaginQueryScheme = Type.Object({
  q: Type.Optional(Type.String()),
  cadre: Type.Optional(Type.String()),
  state: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  departmentId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 5 })),
  sort: Type.Optional(Type.String({ default: "asc" })),
});

// ---------- Enums (Union types) ----------
export const TGender = Type.Union([
  Type.Literal("Male"),
  Type.Literal("Female"),
  Type.Literal("Other"),
  Type.Null(),
]);

export const TCadre = Type.Union([
  Type.Literal("Teaching"),
  Type.Literal("Non-Teaching"),
  Type.Null(),
]);

export const TStaffCategory = Type.Union([
  Type.Literal("Senior"),
  Type.Literal("Junior"),
  Type.Null(),
]);

export const TStaffStatus = Type.Union([
  Type.Literal("Employed"),
  Type.Literal("On Leave"),
  Type.Literal("Retired"),
  Type.Literal("Resigned"),
  Type.Null(),
]);

// ---------- Main Staff Schema ----------
export const postStaffDetailScheme = Type.Object({
  firstName: Type.String(),
  lastName: Type.String(),
  email: Type.String(),
  phone: Type.Union([Type.String(), Type.Null()]),
  dateOfBirth: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  gender: TGender,
  address: Type.Union([Type.String(), Type.Null()]),
  city: Type.Union([Type.String(), Type.Null()]),
  state: Type.Union([Type.String(), Type.Null()]),
  lga: Type.Union([Type.String(), Type.Null()]),
  departmentId: Type.Union([Type.String(), Type.Null()]),
  rankId: Type.String(),
  cadre: TCadre,
  staffCategory: TStaffCategory,
  maritalStatus: Type.Union([Type.String(), Type.Null()]),
  religion: Type.Union([Type.String(), Type.Null()]),
  profilePhoto: Type.Union([Type.String(), Type.Null()]),
  natureOfAppointment: Type.Union([Type.String(), Type.Null()]),
  conuassContiss: Type.Union([Type.String(), Type.Null()]),
  dateOfFirstAppointment: Type.Union([
    Type.String({ format: "date-time" }),
    Type.Null(),
  ]),
  dateOfLastPromotion: Type.Union([
    Type.String({ format: "date-time" }),
    Type.Null(),
  ]),
  status: TStaffStatus,
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const putStaffDetailScheme = Type.Object({
  firstName: Type.Optional(Type.String()),
  lastName: Type.Optional(Type.String()),
  // email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  dateOfBirth: Type.Optional(
    Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  ),
  gender: Type.Optional(TGender),
  address: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  city: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  state: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  lga: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  departmentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  rankId: Type.Optional(Type.String()),
  rank: Type.Optional(Type.String()),
  cadre: Type.Optional(TCadre),
  staffCategory: Type.Optional(TStaffCategory),
  maritalStatus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  religion: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  profilePhoto: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  natureOfAppointment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  conuassContiss: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  dateOfFirstAppointment: Type.Optional(
    Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  ),
  dateOfLastPromotion: Type.Optional(
    Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  ),
  status: Type.Optional(TStaffStatus),
  createdAt: Type.Optional(Type.String({ format: "date-time" })),
  updatedAt: Type.Optional(Type.String({ format: "date-time" })),
});
