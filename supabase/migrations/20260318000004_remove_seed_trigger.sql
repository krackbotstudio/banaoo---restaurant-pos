-- Remove the seed trigger that auto-creates identical sample data for every new user.
-- New users now start with a clean slate and set up their own restaurant via onboarding.

DROP TRIGGER IF EXISTS trigger_seed_sample_data ON public.profiles;
DROP FUNCTION IF EXISTS public.seed_sample_data_for_user();
