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

export type TQaualificationList = {
  data: TQualification[];
  pagination: TPagination | null;
};

export type TQualificationLevelStats = {
  level: string;
  count: number;
}[];
