import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * R12: permissions are checked as "the right to do this action", never as a
 * role name. `@RequirePermissions('approve_listing')` reads from the
 * Permission/UserPermission tables via PermissionsGuard — introducing a
 * moderator role later means seeding a new permission set, not touching
 * this decorator or any guarded controller.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
