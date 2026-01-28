import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Missing Configuration" }, { status: 500 });
  }

  try {
    let allOrders = [];
    let lastId = 0;
    let hasNextPage = true;
    let pageCount = 0;

    // Loop to fetch ALL pages of history
    while (hasNextPage) {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=250&since_id=${lastId}`, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) break;

      const data = await response.json();
      const orders = data.orders;

      if (orders.length === 0) {
        hasNextPage = false;
      } else {
        allOrders = [...allOrders, ...orders];
        lastId = orders[orders.length - 1].id;
        pageCount++;
        if (pageCount > 20) hasNextPage = false; 
      }
    }

    const processedOrders = allOrders.map(order => {
      const customer = order.customer || {};
      const defaultAddr = customer.default_address || {};
      const shipping = order.shipping_address || {};
      const billing = order.billing_address || {};

      // --- ROBUST NAME FINDER ---
      // Priority 1: Customer Profile (The "Real" Record)
      let firstName = customer.first_name || defaultAddr.first_name;
      let lastName = customer.last_name || defaultAddr.last_name;

      // Priority 2: Shipping/Billing (If guest or POS with no profile)
      if (!firstName && !lastName) {
        firstName = shipping.first_name || billing.first_name;
        lastName = shipping.last_name || billing.last_name;
      }

      let customerName = '';
      if (firstName || lastName) {
        customerName = `${firstName || ''} ${lastName || ''}`.trim();
      } else {
        // Priority 3: Composite 'name' fields
        customerName = customer.name || shipping.name || billing.name || '';
      }

      // Fallback: Use Email or Phone as the "Name" if everything else is empty
      if (!customerName) {
          customerName = order.email || order.contact_email || order.phone || customer.phone || 'Guest / Walk-in';
      }

      // --- PHONE CORRECTION ---
      const phone = order.phone || 
                    customer.phone || 
                    defaultAddr.phone || 
                    shipping.phone || 
                    billing.phone || 
                    'No Phone';

      // --- LOCATION CORRECTION ---
      const location = shipping.city 
        ? `${shipping.city}, ${shipping.province_code || ''}` 
        : billing.city 
          ? `${billing.city}, ${billing.province_code || ''}`
          : 'Unknown';

      // --- STATUS LOGIC ---
      let status = 'Pending';
      if (order.cancelled_at) status = 'Cancelled';
      else if (order.fulfillment_status === 'fulfilled') status = 'Delivered';
      else if (order.fulfillment_status === 'partial') status = 'Shipped';
      else if (order.financial_status === 'paid') status = 'Processing';

      return {
        id: `ORD-${order.id}`,
        source: 'Shopify',
        customer_name: customerName,
        customer_phone: phone,
        customer_location: location,
        total_amount: order.total_price,
        original_amount: order.total_price,
        status: status,
        created_at: order.created_at
      };
    });

    const { error } = await supabase
      .from('orders')
      .upsert(processedOrders, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Fixed & Synced ${processedOrders.length} orders.` 
    }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
