import { NextRequest, NextResponse } from "next/server";
import { updateOrderStatus } from "@/lib/order-store";
import { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: OrderStatus[] = [
  "nuevo",
  "en_preparacion",
  "listo",
  "entregado",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as OrderStatus)) {
    return NextResponse.json(
      { error: "Estado inválido." },
      { status: 400 }
    );
  }

  const order = updateOrderStatus(params.id, body.status as OrderStatus);
  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ order });
}
