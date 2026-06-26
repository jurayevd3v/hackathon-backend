import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles-auth-decorator';
import { JwtPayload } from './jwt-auth.guard';
// import { checkWorkingHours, isRestrictedRole } from './working-hours.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    const user = req.user;

    const userRolesArray = Array.isArray(user.role)
      ? (user.role as unknown as string[])
      : [user.role];

    const userRolesUpper = userRolesArray.map((r) => r.toUpperCase());
    const requiredRolesUpper = requiredRoles.map((r) => r.toUpperCase());

    const hasRole = requiredRolesUpper.some((role) =>
      userRolesUpper.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenException("Sizga ruxsat yo'q!");
    }

    // if (isRestrictedRole(userRolesArray)) {
    //   checkWorkingHours();
    // }

    return true;
  }
}
