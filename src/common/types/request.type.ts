import { AuthUser } from './user.type';

export type AuthRequest = Request & { user: AuthUser };
