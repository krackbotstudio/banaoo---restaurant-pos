import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-swiggy-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const outletId = url.searchParams.get('outlet_id');

    if (!outletId) {
      return new Response(
        JSON.stringify({ error: 'Missing outlet_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the integration exists and is active
    const { data: integration, error: integrationError } = await supabase
      .from('platform_integrations')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('platform', 'swiggy')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found or inactive:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integration not configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('Received Swiggy webhook:', JSON.stringify(body));

    // Log the incoming webhook
    await supabase.from('platform_sync_logs').insert({
      integration_id: integration.id,
      action: 'order_received',
      status: 'pending',
      request_data: body,
    });

    // Parse Swiggy order format
    const swiggyOrder = body.order || body;
    
    // Generate order number
    const { data: orderNumberData } = await supabase.rpc('generate_order_number', {
      outlet_id: outletId
    });

    // Create order in our system
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        outlet_id: outletId,
        order_number: orderNumberData || `S-${Date.now()}`,
        status: 'pending',
        order_type: 'delivery',
        source: 'swiggy',
        external_order_id: swiggyOrder.order_id || swiggyOrder.id,
        platform_data: swiggyOrder,
        customer_name: swiggyOrder.customer?.name || swiggyOrder.customer_name || 'Swiggy Customer',
        customer_phone: swiggyOrder.customer?.phone || swiggyOrder.customer_phone,
        delivery_address: swiggyOrder.delivery_address || swiggyOrder.address?.full_address,
        delivery_status: 'assigned',
        subtotal: swiggyOrder.bill?.subtotal || swiggyOrder.subtotal || 0,
        total: swiggyOrder.bill?.total || swiggyOrder.total || 0,
        notes: swiggyOrder.cooking_instructions || swiggyOrder.special_instructions,
        created_by: integration.id,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      
      await supabase.from('platform_sync_logs').insert({
        integration_id: integration.id,
        action: 'order_created',
        status: 'failed',
        error_message: orderError.message,
        request_data: swiggyOrder,
      });

      return new Response(
        JSON.stringify({ error: 'Failed to create order', details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create order items
    const items = swiggyOrder.items || swiggyOrder.cart_items || [];
    for (const item of items) {
      const { data: menuItem } = await supabase
        .from('menu_items')
        .select('id, base_price')
        .eq('outlet_id', outletId)
        .ilike('name', `%${item.name || item.item_name}%`)
        .limit(1)
        .single();

      await supabase.from('order_items').insert({
        order_id: newOrder.id,
        menu_item_id: menuItem?.id || '00000000-0000-0000-0000-000000000000',
        item_name: item.name || item.item_name,
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || menuItem?.base_price || 0,
        total_price: (item.price || item.unit_price || 0) * (item.quantity || 1),
        notes: item.item_instructions || item.notes,
      });
    }

    // Update integration last_synced_at
    await supabase
      .from('platform_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', integration.id);

    // Log success
    await supabase.from('platform_sync_logs').insert({
      integration_id: integration.id,
      action: 'order_created',
      status: 'success',
      request_data: swiggyOrder,
      response_data: { order_id: newOrder.id, order_number: newOrder.order_number },
    });

    console.log('Order created successfully:', newOrder.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: newOrder.id,
        order_number: newOrder.order_number 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
