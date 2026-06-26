import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export const CookieGetter = createParamDecorator(
  (data: string, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const refreshToken = request.cookies[data] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Cookie token topilmadi!');
    }
    return refreshToken;
  },
);
