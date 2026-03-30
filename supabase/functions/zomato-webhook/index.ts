import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zomato-signature',
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
      .eq('platform', 'zomato')
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
    console.log('Received Zomato webhook:', JSON.stringify(body));

    // Log the incoming webhook
    await supabase.from('platform_sync_logs').insert({
      integration_id: integration.id,
      action: 'order_received',
      status: 'pending',
      request_data: body,
    });

    // Parse Zomato order format
    const zomatoOrder = body.order || body;
    
    // Generate order number
    const { data: orderNumberData } = await supabase.rpc('generate_order_number', {
      outlet_id: outletId
    });

    // Create order in our system
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        outlet_id: outletId,
        order_number: orderNumberData || `Z-${Date.now()}`,
        status: 'pending',
        order_type: 'delivery',
        source: 'zomato',
        external_order_id: zomatoOrder.id || zomatoOrder.order_id,
        platform_data: zomatoOrder,
        customer_name: zomatoOrder.customer?.name || zomatoOrder.customer_name || 'Zomato Customer',
        customer_phone: zomatoOrder.customer?.phone || zomatoOrder.customer_phone,
        delivery_address: zomatoOrder.delivery_address || zomatoOrder.address,
        delivery_status: 'assigned',
        subtotal: zomatoOrder.subtotal || zomatoOrder.total || 0,
        total: zomatoOrder.total || 0,
        notes: zomatoOrder.instructions || zomatoOrder.special_instructions,
        created_by: integration.id, // Using integration ID as creator
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      
      // Log failure
      await supabase.from('platform_sync_logs').insert({
        integration_id: integration.id,
        action: 'order_created',
        status: 'failed',
        error_message: orderError.message,
        request_data: zomatoOrder,
      });

      return new Response(
        JSON.stringify({ error: 'Failed to create order', details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create order items
    const items = zomatoOrder.items || zomatoOrder.order_items || [];
    for (const item of items) {
      // Try to find matching menu item
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
        notes: item.instructions || item.notes,
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
      request_data: zomatoOrder,
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
