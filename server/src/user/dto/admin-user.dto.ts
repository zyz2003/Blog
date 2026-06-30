export interface AdminUserDTO {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  username: string;
  nickname: string | null;
  avatar: string | null;
  email: string;
  lastLoginAt: string | null;
  userGroupID: string;
  userGroup: {
    id: string;
    name: string;
    description: string | null;
  };
  status: number;
}
