import { registerCmsAuthRoutes } from './auth.js';
import { registerCmsDashboardRoutes } from './dashboard.js';
import { registerCmsAdminUsersRoutes } from './admin-users.js';
import { registerCmsSubscriptionsRoutes } from './subscriptions.js';
import { registerCmsPaymentsRoutes } from './payments.js';
import { registerCmsMarketingRoutes } from './marketing.js';
import { registerCmsBannerRoutes, registerDashboardBannerPublicRoutes } from './banners.js';
import { registerCmsCustomerRoutes } from './customers.js';
import { registerCmsCustomerSettingsRoutes } from './customer-settings.js';
import { registerCmsMenuRoutes } from './menu.js';

/**
 * Register all CMS-specific routes under /api/cms/*
 * Existing /api/admin/* routes remain; they use requireAdminAccess from middleware.js
 */
export function registerCmsRoutes(app) {
  registerCmsAuthRoutes(app);
  registerCmsDashboardRoutes(app);
  registerCmsAdminUsersRoutes(app);
  registerCmsSubscriptionsRoutes(app);
  registerCmsPaymentsRoutes(app);
  registerCmsMarketingRoutes(app);
  registerCmsBannerRoutes(app);
  registerCmsCustomerRoutes(app);
  registerCmsCustomerSettingsRoutes(app);
  registerCmsMenuRoutes(app);
}

export { registerDashboardBannerPublicRoutes };

export { requireCmsAuth, requireAdminAccess, requireSuperAdmin, getCmsAdmin } from './middleware.js';
export { logAdminAction } from './audit.js';
