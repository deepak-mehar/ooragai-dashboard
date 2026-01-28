import { NextResponse } from 'next/server';

export async function GET(request) {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Missing Configuration in Vercel" }, { status: 500 });
  }

  try {
    // Fetch the latest 5 orders to inspect the raw structure
    const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json?status=any&limit=5`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        return NextResponse.json({ error: "Shopify Error", status: response.status }, { status: response.status });
    }

    const data = await response.json();

    // Return the RAW JSON to the browser
    return NextResponse.json({ 
      message: "Below is the exact data Shopify is sending. Look for 'customer', 'shipping_address', or 'billing_address'.",
      orders: data.orders 
    }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
