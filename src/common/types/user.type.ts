export type AuthUser = {
  userId: string;
  role: string;
  // Every account belongs to exactly one hospital
  hospitalId: string;
};
