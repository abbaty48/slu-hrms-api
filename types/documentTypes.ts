import type { TStaffIdentity } from "./staffTypes.ts";
import type { TPagination } from "./types.ts";

export const mimes = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

export type TDocumentCategory =
  | "AppointmentLetters"
  | "Certificates"
  | "ID&Photos"
  | "Others";

export type TDocument = {
  id: string;
  staffId: string;
  groupId: string;
  staff: TStaffIdentity | null;
  category: string;
  fileName: string;
  fileSize: string | number;
  mimeType: string;
  verifiedBy: string | null;
  verifier: TStaffIdentity | null;
  status: "Verified" | "Pending";
  description: string | null;
  degree: string | null;
  institution: string | null;
  year: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TDocumentSummary = {
  totalDocuments: number;
  totalVerifiedDocuments: number;
  totalPendingDocuments: number;
  categoryDistribution: Record<string, number>;
};

export type TDocumentList = {
  data: TDocument[];
  pagination: TPagination | null;
};

export type TStaffDocument = {
  data: TDocument[];
  pagination: TPagination | null;
};

export type TDocumentStats = {
  total: number;
  verified: number;
  pending: number;
  byCategory: Record<string, number>;
};

export type TUploadDocument = {
  file: File;
  description?: string;
  institution?: string;
  degree?: string;
  year?: string;
};
