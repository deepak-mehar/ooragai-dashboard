import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    // 1. Parse the Shopify JSON payload
    const payload = await request.json();
    
    // 2. Map Shopify data to our Database columns
    const orderId = `ORD-${payload.id}`;
    
    const customer = payload.customer || {};
    const shipping = payload.shipping_address || {};
    
    const customerName = customer.first_name 
      ? `${customer.first_name} ${customer.last_name}` 
      : 'Guest Customer';
      
    const location = shipping.city 
      ? `${shipping.city}, ${shipping.province_code || ''}` 
      : 'Unknown Location';
      
    const phone = shipping.phone || customer.phone || 'No Phone';

    const orderData = {
      id: orderId,
      source: 'Shopify',
      customer_name: customerName,
      customer_phone: phone,
      customer_location: location,
      total_amount: payload.total_price,
      original_amount: payload.total_price,
      status: 'Pending',
      created_at: new Date().toISOString()
    };

    // 3. Save to Supabase
    const { error } = await supabase
      .from('orders')
      .upsert(orderData);

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Order Synced Successfully" }, { status: 200 });

  } catch (err) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
