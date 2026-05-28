import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fittrack_dev_secret_change_in_production';
const JWT_EXPIRES_IN = '7d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookie = request.cookies?.get?.('fittrack_token');
  return cookie?.value || null;
}

export function requireAuth(handler) {
  return async (request, context) => {
    const token = getTokenFromRequest(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    request.user = decoded;
    return handler(request, context);
  };
}
