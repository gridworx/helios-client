// Shared TypeScript types for Helios Platform

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId?: string; // null for platform owners
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  PLATFORM_OWNER = 'platform_owner',
  TENANT_ADMIN = 'tenant_admin',
  TENANT_USER = 'tenant_user'
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  logo?: string;
  primaryColor?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  isEnabled: boolean;
  configSchema?: Record<string, any>;
  config?: Record<string, any>;
  dependencies?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformSettings {
  id: string;
  key: string;
  value: string;
  description?: string;
  isPublic: boolean; // whether setting can be read by non-owners
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  tenantId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Google Workspace Plugin Types
export interface GoogleWorkspaceConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  domain: string;
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends ApiResponse<{
  user: User;
  tokens: AuthTokens;
  tenant?: Tenant;
}> {}

// Platform setup types
export interface PlatformSetupRequest {
  ownerEmail: string;
  ownerPassword: string;
  ownerFirstName: string;
  ownerLastName: string;
  platformName: string;
}

export interface TenantCreateRequest {
  name: string;
  domain: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  logo?: string;
  primaryColor?: string;
}

// Context types for React
export interface TenantContextType {
  currentTenant?: Tenant;
  availableTenants: Tenant[];
  switchTenant: (tenantId: string) => Promise<void>;
  isMSPMode: boolean;
  isLoading: boolean;
  error?: string;
}

export interface AuthContextType {
  user?: User;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error?: string;
}