import { AdminUserDTO } from './admin-user.dto';

export interface AdminListUsersResponse {
  users: AdminUserDTO[];
  total: number;
  page: number;
  size: number;
}
