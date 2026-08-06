import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// Default import, not `import * as` — cookie-parser ships as a CommonJS
// module; with esModuleInterop on (see tsconfig), a default import gets
// the callable function directly instead of a non-callable namespace object.
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Parses the Cookie header into req.cookies — without this, our future
  // /auth/refresh endpoint couldn't read the httpOnly refreshToken cookie
  // back out of incoming requests.
  app.use(cookieParser());

  // enableCors: without this, the browser blocks the frontend's JS from
  // reading ANY response from this API at all — a different protection
  // from CSRF (Step 7). CSRF is about which requests get sent with
  // cookies attached; CORS is about which origins are allowed to read
  // the response of a cross-origin request in the first place.
  app.enableCors({
    // Explicit origin allowlist, not '*' (allow-all) — '*' would let
    // literally any website's JS read responses from this API, which
    // defeats the purpose of having an origin check at all.
    origin: 'http://localhost:3001',
    // credentials: true is REQUIRED for our httpOnly refreshToken cookie
    // to be sent/received cross-origin at all. Without it, the browser
    // strips cookies from cross-origin requests even if the frontend
    // asks for them (via fetch's `credentials: 'include'`).
    credentials: true,
  });

  // useGlobalPipes registers this for EVERY route in the app, not just
  // auth — this is the single place that actually enforces every
  // @IsEmail()/@MinLength()/etc. decorator we've written (and will write).
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: strips any request field NOT declared on the DTO —
      // this is the mass-assignment defense from Step 5 (e.g. a client
      // sending "role": "admin" on signup gets silently dropped here).
      whitelist: true,
      // forbidNonWhitelisted: instead of silently dropping unknown fields,
      // reject the whole request with a 400. Stricter, and better for
      // catching frontend/backend contract mismatches early during dev.
      forbidNonWhitelisted: true,
      // transform: query params and route params ALWAYS arrive as raw
      // strings over HTTP ("page=2", never the number 2) — without this,
      // a DTO field decorated with @Type(() => Number) never actually
      // gets converted; class-validator would then check @IsInt() against
      // the string "2" and reject it, even though "2" is exactly what a
      // real client is supposed to send.
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
