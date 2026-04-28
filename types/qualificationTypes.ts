import type { TPagination } from "./types.ts";

export type TQualification = {
  id: string;
  staffId: string;
  degree: string;
  institution: string;
  year: string;
  level: string;
  isHighest: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TQualificationLevelStats = {
  level: string;
  count: number;
}[];
