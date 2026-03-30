-- Create affiliates table
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  payment_details JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT affiliates_status_check CHECK (status IN ('pending', 'approved', 'suspended'))
);

-- Create affiliate_referrals table
CREATE TABLE public.affiliate_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL,
  referred_outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  referral_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT affiliate_referrals_status_check CHECK (status IN ('pending', 'active', 'churned'))
);

-- Create affiliate_commissions table
CREATE TABLE public.affiliate_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  subscription_payment_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_commissions_status_check CHECK (status IN ('pending', 'paid', 'cancelled'))
);

-- Enable RLS on all tables
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for affiliates table
CREATE POLICY "Users can view their own affiliate record"
  ON public.affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own affiliate application"
  ON public.affiliates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own affiliate record"
  ON public.affiliates FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for affiliate_referrals table
CREATE POLICY "Affiliates can view their own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE affiliates.id = affiliate_referrals.affiliate_id
    AND affiliates.user_id = auth.uid()
  ));

-- RLS policies for affiliate_commissions table
CREATE POLICY "Affiliates can view their own commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE affiliates.id = affiliate_commissions.affiliate_id
    AND affiliates.user_id = auth.uid()
  ));

-- Create index for faster referral code lookups
CREATE INDEX idx_affiliates_referral_code ON public.affiliates(referral_code);
CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);