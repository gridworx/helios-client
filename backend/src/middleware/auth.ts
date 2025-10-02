import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secure_jwt_secret_key_here';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        organizationId: string;
      };
    }
  }
}

/**
 * Middleware to verify JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'No valid authorization token provided'
    });
  }

  const token = authHeader.substring(7);

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }

  if (!decoded || decoded.type !== 'access') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }

  // Attach user info to request
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    organizationId: decoded.organizationId || decoded.tenantId // Support both for migration
  };

  next();
};

/**
 * Middleware to require platform owner role
 */
export const requirePlatformOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'platform_owner') {
    logger.warn('Unauthorized access attempt', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Platform owner access required'
    });
  }

  next();
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't fail if missing
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);

      if (decoded && decoded.type === 'access') {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          organizationId: decoded.organizationId || decoded.tenantId // Support both for migration
        };
      }
    } catch (error) {
      // Token invalid, just continue without user
    }
  }

  next();
};

/**
 * Alias for authenticateToken for better naming consistency
 */
export const requireAuth = authenticateToken;

/**
 * Middleware to require specific permission/role
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // For now, check if user is admin for any permission
    // Later can expand to more granular permissions
    if (permission === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `${permission} permission required`
      });
    }

    next();
  };
};