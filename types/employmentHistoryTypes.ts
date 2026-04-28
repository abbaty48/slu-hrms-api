export type TEmploymentHistory = {
  id: string;
  staffId: string;
  position: string;
  department: string;
  subject: string | null;
  startDate: string;
  endDate: string; // "Present" or "MMM YYYY"
  isActive: boolean;
};
