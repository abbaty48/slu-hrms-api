import type { TPagination } from "./types.ts";

export type TCreateResponsibilityRequest = {
  title: string;
  description: string;
  department?: string;
  assignedTo?: string[];
  priority?: "low" | "medium" | "high";
};

export type TResponsibility = {
  id: string;
  title: string;
  description: string;
  department: string | null;
  assignedTo: string[]; // Array of staff IDs
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  priority: "low" | "medium" | "high";
};

export type TResponsibilitiesList = {
  data: TResponsibility[];
  pagination: TPagination | null;
};
