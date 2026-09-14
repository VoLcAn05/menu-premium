import { NextRequest, NextResponse } from "next/server";
import { createOrder, listOrders } from "@/lib/order-store";
import { OrderItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("restaurante");
  if (!slug) {
    return NextResponse.json(
      { error: "Falta el parámetro 'restaurante'." },
      { status: 400 }
    );
  }
  return NextResponse.json({ orders: listOrders(slug) });
}

export async function POST(req: NextRequest) {
  let body: {
    restaurantSlug?: string;
    table?: number;
    items?: OrderItem[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { restaurantSlug, table, items } = body;

  if (!restaurantSlug || typeof restaurantSlug !== "string") {
    return NextResponse.json(
      { error: "Falta 'restaurantSlug'." },
      { status: 400 }
    );
  }
  if (!table || typeof table !== "number" || table < 1) {
    return NextResponse.json(
      { error: "Número de mesa inválido." },
      { status: 400 }
    );
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "El pedido no tiene productos." },
      { status: 400 }
    );
  }

  const order = createOrder({ restaurantSlug, table, items });
  return NextResponse.json({ order }, { status: 201 });
}
