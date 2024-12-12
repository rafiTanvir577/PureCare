import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(async (data: unknown, ctx: ExecutionContext) => await ctx.switchToHttp().getRequest()?.user);
