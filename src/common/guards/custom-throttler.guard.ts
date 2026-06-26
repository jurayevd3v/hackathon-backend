import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const contextType = context.getType<string>();

    if (contextType !== 'http') {
      return { req: {}, res: {} } as any;
    }

    return super.getRequestResponse(context);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const contextType = context.getType<string>();

    if (contextType !== 'http') {
      return true;
    }

    return super.canActivate(context);
  }
}
