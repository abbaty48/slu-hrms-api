import type { TPagination } from "./types.ts";

export type TCreateAppointmentRequest = {
  name: string;
  description?: string;
  duration?: string;
  benefits?: string[];
};

// List Response Types

export type TAppointmentsList = {
  data: TNatureOfAppointment[];
  pagination: TPagination | null;
};

export type TNatureOfAppointment = {
  id: string;
  name: string;
  duration: string | null; // e.g., "Permanent", "Contract", "Temporary"
  benefits: string[] | [];
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};
