import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), DatabaseModule],
  providers: [JwtStrategy, TokenService, AuthService],
  controllers: [AuthController],
  exports: [PassportModule],
})
export class AuthModule {}
