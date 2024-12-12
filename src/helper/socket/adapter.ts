import { INestApplicationContext, WebSocketAdapter } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { authConfig } from 'config/auth';

export class SocketIoAdapter extends IoAdapter implements WebSocketAdapter {
  jwtService: JwtService;
  constructor(private app: INestApplicationContext) {
    super(app);
    this.jwtService = app.get(JwtService);
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.use(async (socket: Socket, next: (err?: any) => void) => {
      try {
        // Extract the token from the query parameters or headers
        const token = socket.handshake.query.token || socket.handshake.headers.authorization;

        if (!token) {
          return next(new Error('Unauthorized'));
        }

        // Extract the token part (excluding the "Bearer" prefix)
        const tokenString = this.extractBearerToken(token as string);

        // Verify and decode the token using JwtService
        const decoded = await this.jwtService.verify(tokenString, {
          secret: authConfig.jwt_key,
        });

        // Attach the user data to the socket for later use
        socket['user'] = decoded;

        return next();
      } catch (error) {
        return next(error);
      }
    });
    return server;
  }

  // Helper function to extract the token from the "Bearer" prefix
  private extractBearerToken(authorization: string): string {
    const [bearer, token] = authorization.split(' ');
    if (token && bearer === 'Bearer') {
      return token;
    }
    throw new Error('Invalid token format');
  }
}
