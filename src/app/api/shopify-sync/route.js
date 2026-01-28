import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  // You need to add these two keys to your Vercel Environment Variables
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN; // e.g. "ooragai-originals.myshopify.com"
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN; // Starts with "shpat_..."

  // Check for missing variables and report exactly which one is missing
  const missingVars = [];
  if (!SHOPIFY_DOMAIN) missingVars.push('SHOPIFY_STORE_DOMAIN');
  if (!SHOPIFY_ACCESS_TOKEN) missingVars.push('SHOPIFY_ADMIN_ACCESS_TOKEN');

  if (missingVars.length > 0) {
    return NextResponse.json({ 
      error: "Missing Configuration", 
      details: `Please add the following keys to your Vercel Environment Variables (Settings > Environment Variables): ${missingVars.join(', ')}`,
      tip: "If you just added them, go to the 'Deployments' tab in Vercel and click 'Redeploy' for them to take effect."
    }, { status: 500 });
  }

  try {
    // 1. Fetch the last 250 orders from Shopify
    // We use "status=any" to get open, closed, and cancelled orders
    const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=250`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: "Shopify API Error", details: errText }, { status: response.status });
    }

    const data = await response.json();
    const orders = data.orders;

    // 2. Transform Shopify data to match our Supabase structure
    const processedOrders = orders.map(order => {
      const customer = order.customer || {};
      const shipping = order.shipping_address || {};

      // Determine status based on financial/fulfillment state
      let status = 'Pending';
      if (order.fulfillment_status === 'fulfilled') status = 'Delivered';
      else if (order.fulfillment_status === 'partial') status = 'Shipped';
      else if (order.financial_status === 'paid') status = 'Processing';

      return {
        id: `ORD-${order.id}`,
        source: 'Shopify',
        customer_name: customer.first_name ? `${customer.first_name} ${customer.last_name}` : 'Guest',
        customer_phone: shipping.phone || customer.phone || 'No Phone',
        customer_location: shipping.city ? `${shipping.city}, ${shipping.province_code || ''}` : 'Unknown',
        total_amount: order.total_price,
        original_amount: order.total_price,
        status: status,
        created_at: order.created_at
      };
    });

    // 3. Batch Insert/Update into Supabase
    const { error } = await supabase
      .from('orders')
      .upsert(processedOrders, { onConflict: 'id' });

    if (error) {
      console.error('Supabase Sync Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${processedOrders.length} orders from history.` 
    }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
