import { UserRole } from '../types';

export const CANONICAL_ROLES: readonly UserRole[] = ['FARMER', 'VENDOR', 'CUSTOMER', 'ADMIN'] as const;

/**
 * Normalizes any role input (e.g. lowercase 'farmer', legacy format) into a canonical UserRole.
 * Crucially, missing or unknown roles return null; NEVER silently default to FARMER.
 */
export function normalizeRole(role?: string | null): UserRole | null {
  if (!role || typeof role !== 'string') {
    return null;
  }
  const upper = role.trim().toUpperCase();
  if (upper === 'FARMER') return 'FARMER';
  if (upper === 'VENDOR') return 'VENDOR';
  if (upper === 'CUSTOMER') return 'CUSTOMER';
  if (upper === 'ADMIN') return 'ADMIN';
  if (upper === 'BUYER') return 'BUYER';
  if (upper === 'TRANSPORTER') return 'TRANSPORTER';
  return null;
}

/**
 * Authoritative central resolver from application role to dedicated dashboard route.
 */
export function getDashboardRouteForRole(role?: string | null): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case 'FARMER':
      return '/farmer/dashboard';
    case 'VENDOR':
      return '/vendor/dashboard';
    case 'CUSTOMER':
      return '/customer/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}

/**
 * Determines the target role required to access a protected workspace route.
 * Returns null for public routes (e.g. landing page, login, onboarding, trace).
 */
export function getRequiredRoleForPath(pathname: string): UserRole | null {
  if (!pathname) return null;
  const path = pathname.toLowerCase();

  if (path.startsWith('/farmer')) return 'FARMER';
  if (path.startsWith('/vendor')) return 'VENDOR';
  if (path.startsWith('/customer')) return 'CUSTOMER';
  if (path.startsWith('/admin')) return 'ADMIN';

  return null;
}

/**
 * Centralized authorization check for route guards.
 * ADMIN has administrative privileges across portals unless restricted.
 * Specific role users (e.g. CUSTOMER, VENDOR) cannot cross into forbidden portals.
 */
export function isRoleAuthorizedForPath(role: string | null | undefined, pathname: string): boolean {
  const requiredRole = getRequiredRoleForPath(pathname);
  if (!requiredRole) {
    // Public or unmanaged route
    return true;
  }

  const userRole = normalizeRole(role);
  if (!userRole) {
    return false;
  }

  // ADMIN can access any portal
  if (userRole === 'ADMIN') {
    return true;
  }

  // Exact role match required
  return userRole === requiredRole;
}

/**
 * Validates whether a user's role is authorized to view a specific portal.
 * ADMIN has global access across all portals.
 * Specific role users can only access their respective portal.
 */
export function isRoleAuthorizedForPortal(
  role: string | null | undefined,
  portal: 'farmer' | 'vendor' | 'customer' | 'admin'
): boolean {
  const normUserRole = normalizeRole(role);
  if (!normUserRole) return false;
  if (normUserRole === 'ADMIN') return true;
  return normUserRole === portal.toUpperCase();
}

