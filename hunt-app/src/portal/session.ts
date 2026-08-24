import session from 'express-session';
import RedisStore from 'connect-redis';
import { redis } from '../db/redis';
import { env } from '../config/env';

// Redis-backed so a redeploy (which happens often during active
// development) doesn't silently log the operator out — an in-memory
// session store would lose everything on every container restart.
export function buildSessionMiddleware() {
  return session({
    store: new RedisStore({ client: redis, prefix: 'hunt-portal-session:' }),
    secret: env.SESSION_SECRET ?? 'dev-only-insecure-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // This deployment is plain HTTP on a private LAN (192.168.1.195),
      // not HTTPS — `secure: true` would silently break every login by
      // making the browser refuse to send the cookie at all. Revisit if
      // this is ever put behind TLS (see AEOS's Caddy reverse-proxy
      // pattern for how that would look).
      secure: false,
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    },
  });
}
