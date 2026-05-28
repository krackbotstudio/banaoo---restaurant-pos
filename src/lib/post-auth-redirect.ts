/** Where to send a user after restaurant owner/staff sign-in (never CMS). */
export function getRestaurantPostAuthPath(profile: {
  role?: string | null;
  account_status?: string | null;
  onboarding_completed?: boolean | null;
}): string {
  if (profile.role && profile.role !== "owner") {
    return "/dashboard";
  }
  if (profile.account_status === "rejected" || profile.account_status === "pending") {
    return "/account-pending";
  }
  if (!profile.onboarding_completed) {
    return "/onboarding";
  }
  return "/dashboard";
}
