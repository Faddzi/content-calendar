export type WorkspaceRole = "admin" | "contributor" | "viewer";

export type Workspace = {
  id: string;
  name: string;
};

export type Company = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
};

export type CalendarPost = {
  id: string;
  workspace_id: string;
  company_id: string;
  platform: string;
  topic: string;
  scheduled_for: string;
  published_url: string | null;
  created_by: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  email: string | null;
};

export type WorkspaceInvitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string;
};
