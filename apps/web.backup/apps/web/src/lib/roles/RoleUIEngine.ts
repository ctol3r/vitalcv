/**
 * Role UI Engine
 * Phase 4: Role-Based UI Modes
 *
 * The app visually transforms depending on the role.
 */

import { RoleType, roleEngine, RoleMetadata } from './RoleEngine';

/**
 * UI Theme Configuration
 */
export interface RoleUITheme {
  colors: {
    primary: string;
    accent: string;
    trust: string;
    background: string;
    foreground: string;
  };
  icons: {
    main: string;
    navigation: Record<string, string>;
  };
  shapes: {
    header: 'rounded' | 'square' | 'pill';
    buttons: 'rounded' | 'square' | 'pill';
  };
}

/**
 * Navigation Route
 */
export interface NavigationRoute {
  path: string;
  label: string;
  icon: string;
  badge?: number;
  visible: boolean;
}

/**
 * Floating Action Button (FAB)
 */
export interface FloatingAction {
  id: string;
  label: string;
  icon: string;
  action: string;
  visible: boolean;
  color?: string;
}

/**
 * RoleUIEngine
 * Manages UI theming and navigation per role
 */
export class RoleUIEngine {
  /**
   * Get UI theme for a role
   */
  getRoleTheme(roleType: RoleType): RoleUITheme {
    const metadata = roleEngine.getRoleMetadata(roleType);

    return {
      colors: {
        primary: metadata.color.primary,
        accent: metadata.color.accent,
        trust: metadata.color.trust,
        background: '#ffffff',
        foreground: '#000000',
      },
      icons: {
        main: metadata.icon,
        navigation: this.getNavigationIcons(roleType),
      },
      shapes: {
        header: 'rounded',
        buttons: 'rounded',
      },
    };
  }

  /**
   * Get navigation routes for a role
   */
  getNavigationRoutes(roleType: RoleType): NavigationRoute[] {
    const metadata = roleEngine.getRoleMetadata(roleType);
    const baseRoutes = metadata.navigation.primaryRoutes;

    const routeConfig: Record<string, { label: string; icon: string }> = {
      '/wallet': { label: 'Wallet', icon: 'wallet' },
      '/verify': { label: 'Verify', icon: 'shield-check' },
      '/jobs': { label: 'Jobs', icon: 'briefcase' },
      '/profile': { label: 'Profile', icon: 'user' },
      '/ceu': { label: 'CEU', icon: 'graduation-cap' },
      '/shifts': { label: 'Shifts', icon: 'calendar' },
      '/portfolio': { label: 'Portfolio', icon: 'folder' },
      '/evaluate': { label: 'Evaluate', icon: 'clipboard-check' },
      '/publications': { label: 'Publications', icon: 'file-text' },
      '/grants': { label: 'Grants', icon: 'dollar-sign' },
      '/irb': { label: 'IRB', icon: 'shield' },
      '/cv': { label: 'CV', icon: 'file-text' },
      '/dashboard': { label: 'Dashboard', icon: 'layout-dashboard' },
      '/compliance': { label: 'Compliance', icon: 'check-circle' },
      '/leadership': { label: 'Leadership', icon: 'users' },
      '/supervision': { label: 'Supervision', icon: 'user-check' },
      '/mentees': { label: 'Mentees', icon: 'users' },
      '/telemedicine': { label: 'Telemedicine', icon: 'video' },
      '/licenses': { label: 'Licenses', icon: 'id-card' },
      '/regions': { label: 'Regions', icon: 'map' },
      '/facilities': { label: 'Facilities', icon: 'building' },
      '/privileges': { label: 'Privileges', icon: 'key' },
      '/scheduling': { label: 'Scheduling', icon: 'calendar' },
    };

    return baseRoutes.map((path) => ({
      path,
      label: routeConfig[path]?.label || path,
      icon: routeConfig[path]?.icon || 'circle',
      visible: true,
    }));
  }

  /**
   * Get floating action buttons for a role
   */
  getFloatingActions(roleType: RoleType): FloatingAction[] {
    const metadata = roleEngine.getRoleMetadata(roleType);
    const actions = metadata.navigation.floatingActions;

    const actionConfig: Record<string, { label: string; icon: string }> = {
      'verify-credential': { label: 'Verify Credential', icon: 'shield-check' },
      'share-profile': { label: 'Share Profile', icon: 'share' },
      'track-ceu': { label: 'Track CEU', icon: 'graduation-cap' },
      'view-shifts': { label: 'View Shifts', icon: 'calendar' },
      'evaluate-resident': { label: 'Evaluate Resident', icon: 'clipboard-check' },
      'add-publication': { label: 'Add Publication', icon: 'file-text' },
      'submit-grant': { label: 'Submit Grant', icon: 'dollar-sign' },
      'track-irb': { label: 'Track IRB', icon: 'shield' },
      'view-compliance': { label: 'View Compliance', icon: 'check-circle' },
      'manage-team': { label: 'Manage Team', icon: 'users' },
      'evaluate-mentee': { label: 'Evaluate Mentee', icon: 'user-check' },
      'schedule-session': { label: 'Schedule Session', icon: 'calendar' },
      'check-eligibility': { label: 'Check Eligibility', icon: 'map' },
      'view-regions': { label: 'View Regions', icon: 'map' },
      'manage-privileges': { label: 'Manage Privileges', icon: 'key' },
      'view-schedule': { label: 'View Schedule', icon: 'calendar' },
    };

    return actions.map((actionId) => {
      const config = actionConfig[actionId] || { label: actionId, icon: 'circle' };
      return {
        id: actionId,
        label: config.label,
        icon: config.icon,
        action: actionId,
        visible: true,
        color: roleEngine.getRoleMetadata(roleType).color.primary,
      };
    });
  }

  /**
   * Get navigation icons mapping
   */
  private getNavigationIcons(roleType: RoleType): Record<string, string> {
    const routes = this.getNavigationRoutes(roleType);
    const icons: Record<string, string> = {};

    routes.forEach((route) => {
      icons[route.path] = route.icon;
    });

    return icons;
  }

  /**
   * Get role mode indicator
   * Returns a badge/indicator for the current role
   */
  getRoleModeIndicator(roleType: RoleType): {
    label: string;
    color: string;
    icon: string;
  } {
    const metadata = roleEngine.getRoleMetadata(roleType);

    return {
      label: metadata.displayName,
      color: metadata.color.primary,
      icon: metadata.icon,
    };
  }

  /**
   * Check if recruiter-mode interactions should be disabled
   * Some roles shouldn't interact with recruiter features
   */
  isRecruiterModeDisabled(roleType: RoleType): boolean {
    // Recruiter mode is only enabled for clinician roles
    const recruiterEnabledRoles = [
      RoleType.CLINICIAN,
      RoleType.NURSE,
      RoleType.TELEMEDICINE,
    ];

    return !recruiterEnabledRoles.includes(roleType);
  }

  /**
   * Get role-blending visual configuration
   * When two roles overlap, create a blended visual
   */
  getRoleBlending(
    primaryRole: RoleType,
    secondaryRole: RoleType | null
  ): {
    primaryColor: string;
    secondaryColor: string | null;
    blendMode: 'overlay' | 'gradient' | 'split';
    intensity: number;
  } {
    const primary = roleEngine.getRoleMetadata(primaryRole);

    if (!secondaryRole) {
      return {
        primaryColor: primary.color.primary,
        secondaryColor: null,
        blendMode: 'overlay',
        intensity: 1.0,
      };
    }

    const secondary = roleEngine.getRoleMetadata(secondaryRole);

    return {
      primaryColor: primary.color.primary,
      secondaryColor: secondary.color.primary,
      blendMode: 'gradient',
      intensity: 0.5, // 50% blend
    };
  }

  /**
   * Get role-tuned trust animations
   * Different roles have different trust animation styles
   */
  getTrustAnimationConfig(roleType: RoleType): {
    type: 'pulse' | 'wave' | 'glow' | 'ripple';
    speed: 'slow' | 'normal' | 'fast';
    intensity: number;
    color: string;
  } {
    const metadata = roleEngine.getRoleMetadata(roleType);

    const configs: Record<RoleType, { type: 'pulse' | 'wave' | 'glow' | 'ripple'; speed: 'slow' | 'normal' | 'fast' }> = {
      [RoleType.CLINICIAN]: { type: 'pulse', speed: 'normal' },
      [RoleType.NURSE]: { type: 'wave', speed: 'slow' },
      [RoleType.FACULTY]: { type: 'glow', speed: 'slow' },
      [RoleType.RESEARCHER]: { type: 'ripple', speed: 'fast' },
      [RoleType.ADMINISTRATOR]: { type: 'pulse', speed: 'normal' },
      [RoleType.PRECEPTOR]: { type: 'wave', speed: 'normal' },
      [RoleType.TELEMEDICINE]: { type: 'glow', speed: 'fast' },
      [RoleType.MULTI_FACILITY]: { type: 'ripple', speed: 'normal' },
    };

    const config = configs[roleType] || { type: 'pulse', speed: 'normal' };

    return {
      ...config,
      intensity: 0.8,
      color: metadata.color.trust,
    };
  }
}

// Singleton instance
export const roleUIEngine = new RoleUIEngine();

