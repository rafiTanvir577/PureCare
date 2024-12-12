import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const FileInfo = createParamDecorator(async (data: unknown, ctx: ExecutionContext) => await ctx.switchToHttp().getRequest()?.fileDetails);
