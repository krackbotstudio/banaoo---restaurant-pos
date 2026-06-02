-- Ensure sample menu seed trigger stays removed (idempotent).
DROP TRIGGER IF EXISTS trigger_seed_sample_data ON public.profiles;
DROP FUNCTION IF EXISTS public.seed_sample_data_for_user();
