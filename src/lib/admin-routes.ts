export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_DEFAULT_PATH = "/admin/reservations";

export function getPostLoginAdminPath(path: string | null | undefined) {
  if (!path) return ADMIN_DEFAULT_PATH;
  if (!path.startsWith("/admin/")) return ADMIN_DEFAULT_PATH;
  if (path === ADMIN_LOGIN_PATH) return ADMIN_DEFAULT_PATH;

  return path;
}
