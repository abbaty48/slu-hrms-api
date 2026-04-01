import type { __pagination } from "#utils/utils_helper.ts";

export type TDocRow = {
  id: string;
  staffId: string;
  title: string;
  category: string;
  mimeType: string;
  fileSize: number;
  isVerified: boolean;
  createdAt: Date;
  description: string | null;
  degree: string | null;
  institution: string | null;
  year: string | null;
};

export type TDocumentItem = {
  id: string;
  staffId: string;
  staffName: string;
  title: string;
  category: string;
  fileType: string;
  fileSize: string;
  mimeType: string;
  status: "Verified" | "Pending";
  uploadedAt: Date;
  description: string | null;
  degree: string | null;
  institution: string | null;
  year: string | null;
};

export type TDocumentSummary = {
  totalDocuments: number;
  verifiedDocuments: number;
  pendingDocuments: number;
  categoryDistribution: Record<string, number>;
};

export type TDocumentList = {
  documents: TDocumentItem[];
  pagination: ReturnType<typeof __pagination> | null;
};

export type TStaffDocument = {
  summary: TDocumentSummary | null;
  data: TDocumentItem[];
};

export type TDocumentStats = {
  total: number;
  verified: number;
  pending: number;
  byCategory: Record<string, number>;
};
