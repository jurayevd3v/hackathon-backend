import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface JwtPayload {
  id: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    const token = this.extractToken(req);

    try {
      req.user = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_KEY'),
      });
    } catch {
      throw new UnauthorizedException("Token noto'g'ri yoki muddati tugagan!");
    }

    return true;
  }

  private extractToken(req: Request): string {
    const authHeader = (req as any).headers.authorization;
    if (!authHeader)
      throw new UnauthorizedException('Authorization header topilmadi!');
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token)
      throw new UnauthorizedException("Token formati noto'g'ri!");
    return token;
  }
}
