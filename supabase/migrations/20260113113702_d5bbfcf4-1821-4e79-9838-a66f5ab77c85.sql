-- Create affiliate_payouts table for payout requests and history
CREATE TABLE public.affiliate_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  payment_method TEXT NOT NULL DEFAULT 'upi',
  payment_details JSONB DEFAULT '{}'::jsonb,
  transaction_id TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own payouts
CREATE POLICY "Affiliates can view their own payouts"
ON public.affiliate_payouts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE affiliates.id = affiliate_payouts.affiliate_id
    AND affiliates.user_id = auth.uid()
  )
);

-- Affiliates can request payouts (insert)
CREATE POLICY "Affiliates can request payouts"
ON public.affiliate_payouts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE affiliates.id = affiliate_payouts.affiliate_id
    AND affiliates.user_id = auth.uid()
    AND affiliates.status = 'approved'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_affiliate_payouts_affiliate_id ON public.affiliate_payouts(affiliate_id);
CREATE INDEX idx_affiliate_payouts_status ON public.affiliate_payouts(status);