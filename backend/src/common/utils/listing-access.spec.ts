import { canEditListing, isAdminDraft } from './listing-access';

function prismaWith(grantCount: number) {
  return { userPermission: { count: jest.fn(async () => grantCount) } } as any;
}

describe('canEditListing (Administracija > Oglasi)', () => {
  it('lets the owner in without asking about permissions', async () => {
    const prisma = prismaWith(0);
    await expect(canEditListing(prisma, 'owner', { userId: 'owner', createdByAdminId: null })).resolves.toBe(true);
    expect(prisma.userPermission.count).not.toHaveBeenCalled();
  });

  it('keeps a listing an owner added theirs alone, even for an admin', async () => {
    const prisma = prismaWith(1);
    await expect(canEditListing(prisma, 'admin', { userId: 'owner', createdByAdminId: null })).resolves.toBe(false);
    expect(prisma.userPermission.count).not.toHaveBeenCalled();
  });

  it('opens a listing an admin added to admins holding the permission', async () => {
    const holder = prismaWith(1);
    await expect(canEditListing(holder, 'admin-2', { userId: 'owner', createdByAdminId: 'admin-1' })).resolves.toBe(true);
    expect(holder.userPermission.count).toHaveBeenCalledWith({
      where: { userId: 'admin-2', permission: { key: 'manage_free_listings' } },
    });
    await expect(canEditListing(prismaWith(0), 'guest', { userId: 'owner', createdByAdminId: 'admin-1' })).resolves.toBe(false);
  });
});

describe('isAdminDraft', () => {
  it('is a listing an admin added and never published', () => {
    expect(isAdminDraft({ createdByAdminId: 'admin', subscriptionId: null })).toBe(true);
    expect(isAdminDraft({ createdByAdminId: 'admin', subscriptionId: 'sub' })).toBe(false);
    expect(isAdminDraft({ createdByAdminId: null, subscriptionId: null })).toBe(false);
  });
});
