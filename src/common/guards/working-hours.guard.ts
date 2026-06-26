import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const RESTRICTED_ROLES = ['broker', 'operator', 'supplier'];

@Injectable()
export class WorkingHoursGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { role: string | string[] } }>();
    const user = req.user;

    if (!user) return true;

    if (isRestrictedRole(user.role)) {
      checkWorkingHours();
    }

    return true;
  }
}

export function checkWorkingHours(): void {
  const now = new Date();
  const tashkentHour = (now.getUTCHours() + 5) % 24;

  if (tashkentHour < 9 || tashkentHour >= 18) {
    throw new ForbiddenException(
      'Tizimga kirish faqat ish vaqtida mumkin: 09:00 - 18:00',
    );
  }
}

export function isRestrictedRole(role: string | string[]): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => RESTRICTED_ROLES.includes(r.toLowerCase()));
}
