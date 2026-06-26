import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { v4 as uuid } from 'uuid';
import { User } from '../user/models/user.model';
import { Tokens } from './auth.types';

interface RefreshTokenPayload {
  id: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectModel(User) private readonly userRepo: typeof User,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(username: string, password: string, res: Response) {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.hashed_password))) {
      throw new UnauthorizedException("Username yoki parol noto'g'ri!");
    }

    this.logger.log(`Login: User name=${username} | role=${user.role}`);

    if (!user.is_login) {
      throw new ForbiddenException('Sizga kirish taqiqlangan!');
    }

    const tokens = await this.getTokens(user);

    await this.sequelize.transaction(async (t) => {
      await this.updateRefreshToken(
        user.id,
        tokens.refresh_token,
        tokens.jti,
        t,
      );
    });

    this.setRefreshCookie(res, tokens.refresh_token);

    return { user, tokens };
  }

  async logout(userId: string, res: Response) {
    await this.sequelize.transaction(async (t) => {
      await this.clearRefreshToken(userId, t);
    });
    res.clearCookie('refresh_token');
  }

  async refreshToken(userId: string, refreshToken: string, res: Response) {
    return this.sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (t) => {
        const user = await this.userRepo.findByPk(userId, { transaction: t });

        if (!user?.hashed_refresh_token) {
          throw new ForbiddenException("Ruxsat yo'q!");
        }

        if (!user.is_login) {
          throw new ForbiddenException('Sizga kirish taqiqlangan!');
        }

        let payload: RefreshTokenPayload;
        try {
          payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
            refreshToken,
            { secret: this.configService.get<string>('REFRESH_TOKEN_KEY') },
          );
        } catch {
          throw new ForbiddenException(
            "Refresh token eskirgan yoki noto'g'ri!",
          );
        }

        if (payload.id !== user.id) {
          throw new ForbiddenException("Ruxsat yo'q!");
        }

        if (payload.jti !== user.refresh_token_jti) {
          throw new ForbiddenException('Refresh token bekor qilingan!');
        }

        const isValid = await bcrypt.compare(
          refreshToken,
          user.hashed_refresh_token,
        );
        if (!isValid) {
          throw new ForbiddenException("Ruxsat yo'q!");
        }

        const tokens = await this.getTokens(user);
        await this.updateRefreshToken(
          user.id,
          tokens.refresh_token,
          tokens.jti,
          t,
        );
        this.setRefreshCookie(res, tokens.refresh_token);

        return tokens;
      },
    );
  }

  private async getTokens(user: User): Promise<Tokens> {
    const jti = uuid();

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(
        { id: user.id, role: user.role },
        {
          secret: this.configService.get('ACCESS_TOKEN_KEY'),
          expiresIn: this.configService.get('ACCESS_TOKEN_TIME', '60m'),
        },
      ),
      this.jwtService.signAsync(
        { id: user.id, role: user.role, jti },
        {
          secret: this.configService.get<string>('REFRESH_TOKEN_KEY'),
          expiresIn: this.configService.get<string>(
            'REFRESH_TOKEN_TIME',
            '15d',
          ) as any,
        },
      ),
    ]);

    return { access_token, refresh_token, jti };
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    const refreshTimeRaw = this.configService.get<string>(
      'REFRESH_TOKEN_TIME',
      '15d',
    );
    const days = parseInt(refreshTimeRaw, 10);
    const maxAge = (isNaN(days) ? 15 : days) * 24 * 60 * 60 * 1000;

    res.cookie('refresh_token', refreshToken, {
      maxAge,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
    jti: string,
    transaction?: Transaction,
  ): Promise<void> {
    const hashed_refresh_token = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(
      { hashed_refresh_token, refresh_token_jti: jti },
      { where: { id: userId }, transaction },
    );
  }

  private async clearRefreshToken(
    userId: string,
    transaction?: Transaction,
  ): Promise<void> {
    await this.userRepo.update(
      { hashed_refresh_token: null, refresh_token_jti: null },
      { where: { id: userId }, transaction },
    );
  }
}
