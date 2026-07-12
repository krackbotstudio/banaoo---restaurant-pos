-- Delete existing customer rows to avoid conflicts with new constraints
TRUNCATE TABLE public.customer_addresses CASCADE;
TRUNCATE TABLE public.customers CASCADE;

-- Add owner_id to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Drop old unique constraint on phone
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_phone_key;

-- Add new unique constraint on phone + owner_id
ALTER TABLE public.customers ADD CONSTRAINT customers_phone_owner_id_key UNIQUE (phone, owner_id);
