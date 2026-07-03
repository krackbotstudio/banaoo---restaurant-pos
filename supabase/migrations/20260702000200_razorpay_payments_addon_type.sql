-- Allow razorpay_payments (and shiprocket_delivery) as subscription add-on types.
ALTER TABLE public.subscription_addons
  DROP CONSTRAINT IF EXISTS subscription_addons_addon_type_check;

ALTER TABLE public.subscription_addons
  ADD CONSTRAINT subscription_addons_addon_type_check CHECK (
    addon_type IN (
      'extra_outlet',
      'extra_staff',
      'swiggy_integration',
      'zomato_integration',
      'customer_ordering',
      'inventory_management',
      'whatsapp_integration',
      'shiprocket_delivery',
      'razorpay_payments'
    )
  );
