import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secure_jwt_secret_key_here';

/**
 * Determine if a role has admin privileges
 */
function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'platform_owner';
}

/**
 * Determine if user is an employee (can access user/employee UI)
 * External admins (MSPs, consultants) are NOT employees.
 */
function isEmployeeUser(isExternalAdmin: boolean | undefined): boolean {
  // External admins are not employees
  return isExternalAdmin !== true;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        organizationId: string;
        firstName?: string;
        lastName?: string;
        // Access control flags
        isAdmin: boolean;       // Can access admin UI
        isEmployee: boolean;    // Can access employee/user UI
        // API Key context
        keyType?: 'service' | 'vendor';
        apiKeyId?: string;
        apiKeyName?: string;
        serviceName?: string;
        serviceEmail?: string;
        serviceOwner?: string;
        vendorName?: string;
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

  // Attach user info to request with access flags
  // isExternalAdmin comes from the JWT token payload
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    organizationId: decoded.organizationId,
    isAdmin: isAdminRole(decoded.role),
    isEmployee: isEmployeeUser(decoded.isExternalAdmin)
  };

  next();
};

/**
 * Middleware to require admin privileges
 * Use for routes that require administrative access
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!req.user.isAdmin) {
    logger.warn('Unauthorized admin access attempt', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * Middleware to require employee status
 * Use for routes that require employee/user access (People, My Team, My Profile)
 */
export const requireEmployee = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!req.user.isEmployee) {
    logger.warn('Unauthorized employee access attempt', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Employee access required. External admins cannot access this feature.'
    });
  }

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
          organizationId: decoded.organizationId,
          isAdmin: isAdminRole(decoded.role),
          isEmployee: isEmployeeUser(decoded.isExternalAdmin)
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
 * This middleware also handles authentication, so no need to call requireAuth separately
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // First, authenticate the token
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
      organizationId: decoded.organizationId,
      isAdmin: isAdminRole(decoded.role),
      isEmployee: isEmployeeUser(decoded.isExternalAdmin)
    };

    // Now check permission
    if (permission === 'admin' && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `${permission} permission required`
      });
    }

    next();
  };
};