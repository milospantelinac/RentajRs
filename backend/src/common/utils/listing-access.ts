import { Listing, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Administracija > Oglasi: the permission to add listings for users without payment and set how long they last. */
export const MANAGE_FREE_LISTINGS = 'manage_free_listings';

/**
 * A listing an admin is still preparing for its owner: added by an admin and
 * never published. The owner sees it only once it is published (the user,
 * 2026-10-22), so Moji oglasi and the home page leave it out.
 */
export const ADMIN_DRAFT: Prisma.ListingWhereInput = { createdByAdminId: { not: null }, subscriptionId: null };

export function isAdminDraft(listing: Pick<Listing, 'createdByAdminId' | 'subscriptionId'>): boolean {
  return !!listing.createdByAdminId && !listing.subscriptionId;
}

/**
 * Who may work on a listing in the wizard: its owner, and, for a listing an
 * admin added for its owner (createdByAdminId), every admin holding
 * manage_free_listings. A listing an owner added stays theirs alone (the
 * user, 2026-10-22).
 */
export async function canEditListing(
  prisma: PrismaService,
  userId: string,
  listing: Pick<Listing, 'userId' | 'createdByAdminId'>,
): Promise<boolean> {
  if (listing.userId === userId) return true;
  if (!listing.createdByAdminId) return false;
  return hasPermission(prisma, userId, MANAGE_FREE_LISTINGS);
}

export async function hasPermission(prisma: PrismaService, userId: string, key: string): Promise<boolean> {
  const count = await prisma.userPermission.count({ where: { userId, permission: { key } } });
  return count > 0;
}
