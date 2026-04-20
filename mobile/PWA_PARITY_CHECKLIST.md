# PWA to Mobile Parity Checklist

This checklist is the implementation lock for pixel-strict parity with the PWA mobile view.

## Global System

- [ ] Typography aligns with PWA (DM Sans weights and hierarchy)
- [ ] Color tokens align with PWA theme variables from `src/index.css`
- [ ] Radius, border, spacing, and elevation scales align with PWA mobile UI
- [ ] Top toast/notification placement aligns with PWA
- [ ] Auth/loading/empty/error states follow PWA visual style

## Access and Guard Flow

- [ ] Unauthenticated users land on auth flow equivalent
- [ ] Pending/rejected account redirect aligns with PWA `ProtectedRoute`
- [ ] Onboarding-incomplete users are routed to onboarding equivalent
- [ ] Staff users are restricted to allowed modules by permission keys
- [ ] Owner/admin users get unrestricted protected route access

## Protected Module Parity

- [ ] Dashboard
- [ ] Outlets
- [ ] Outlet detail
- [ ] Menu
- [ ] Orders
- [ ] New Order
- [ ] Kitchen
- [ ] Staff
- [ ] Settings
- [ ] Integrations
- [ ] Order History
- [ ] Customers
- [ ] Analytics
- [ ] Account Pending
- [ ] Onboarding

## Public/Auth Parity

- [ ] Auth
- [ ] Staff Login behavior equivalent
- [ ] Auth callback handling equivalent

## Printing Parity

- [ ] Kitchen printer assignment flow
- [ ] Billing printer assignment flow
- [ ] Print intent behavior mirrors PWA (kitchen vs billing path)
- [ ] Platform constraints communicated clearly in UI

## Release Validation

- [ ] Pixel-check on core flows against PWA mobile screenshots
- [ ] Role scenario test: owner
- [ ] Role scenario test: manager/staff restricted permissions
- [ ] Role scenario test: pending/rejected account
- [ ] APK build and install verified
