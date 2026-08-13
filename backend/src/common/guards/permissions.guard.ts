import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Authentication required');

    const grants = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
    const grantedKeys = new Set(grants.map((g) => g.permission.key));
    const hasAll = required.every((key) => grantedKeys.has(key));
    if (!hasAll) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
