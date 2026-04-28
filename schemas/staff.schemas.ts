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
  Type.Literal("Others"),
]);

export const TCadre = Type.Union([
  Type.Literal("Teaching"),
  Type.Literal("Technical"),
  Type.Literal("Non-Teaching"),
  Type.Literal("Administrative"),
]);

export const TStaffCategory = Type.Union([
  Type.Literal("Senior"),
  Type.Literal("Junior"),
  Type.Null(),
]);

export const TStaffStatus = Type.Union([
  Type.Literal("Employed"),
  Type.Literal("OnLeave"),
  Type.Literal("Retired"),
  Type.Literal("Terminated"),
  Type.Literal("Resigned"),
  Type.Literal("Deceased"),
  Type.Literal("Suspended"),
  Type.Literal("Contract_Ended"),
  Type.Null(),
]);

// ---------- Main Staff Schema ----------
export const postStaffDetailScheme = Type.Object({
  cadre: TCadre,
  gender: TGender,
  status: TStaffStatus,
  email: Type.String(),
  rankId: Type.String(),
  address: Type.String(),
  lastName: Type.String(),
  firstName: Type.String(),
  nationality: Type.String(),
  staffCategory: TStaffCategory,
  lga: Type.Union([Type.String(), Type.Null()]),
  town: Type.Union([Type.String(), Type.Null()]),
  city: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  state: Type.Union([Type.String(), Type.Null()]),
  religion: Type.Union([Type.String(), Type.Null()]),
  departmentId: Type.Union([Type.String(), Type.Null()]),
  statusComment: Type.Union([Type.String(), Type.Null()]),
  placeOfBirth: Type.Union([Type.String(), Type.Null()]),
  maritalStatus: Type.Union([Type.String(), Type.Null()]),
  title: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  profilePhoto: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  conuassContiss: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  natureOfAppointment: Type.Union([Type.String(), Type.Null()]),
  dateOfFirstAppointment: Type.Union([
    Type.String({ format: "date" }),
    Type.Null(),
  ]),
  dateOfLastPromotion: Type.Optional(
    Type.Union([Type.String({ format: "date" }), Type.Null()]),
  ),
  dateOfBirth: Type.Union([Type.String({ format: "date" }), Type.Null()]),
});

export const putStaffDetailScheme = Type.Object({
  gender: Type.Optional(TGender),
  cadre: Type.Optional(TCadre),
  rank: Type.Optional(Type.String()),
  status: Type.Optional(TStaffStatus),
  rankId: Type.Optional(Type.String()),
  lastName: Type.Optional(Type.String()),
  firstName: Type.Optional(Type.String()),
  staffCategory: Type.Optional(TStaffCategory),
  address: Type.Optional(Type.String({ default: "" })),
  nationality: Type.Optional(Type.String({ default: "" })),
  lga: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  town: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  city: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  title: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  state: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  religion: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  departmentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  profilePhoto: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  maritalStatus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  conuassContiss: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  natureOfAppointment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  dateOfBirth: Type.Optional(
    Type.Union([Type.String({ format: "date" }), Type.Null()]),
  ),
  dateOfFirstAppointment: Type.Optional(
    Type.Union([Type.String({ format: "date" }), Type.Null()]),
  ),
  dateOfLastPromotion: Type.Optional(
    Type.Union([Type.String({ format: "date" }), Type.Null()]),
  ),
});

//
export const getStaffIdStatusParamScheme = Type.Object({
  id: Type.String(),
  status: TStaffStatus,
});
