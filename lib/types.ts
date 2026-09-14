export type Model3D = {
  /** glTF binary — funciona en el visor 3D interactivo y en AR de Android (Scene Viewer) */
  glb: string;
  /** USDZ — necesario para activar el modo AR nativo en iPhone (Quick Look). Opcional. */
  usdz?: string;
};

export type Dish = {
  id: string;
  name: string;
  description: string;
  price: number; // en USD, referencia para el demo
  image: string;
  category: string;
  tags?: string[]; // p.ej. "picante", "vegetariano", "más pedido"
  portion?: string; // p.ej. "280 g · rinde para 1-2 personas"
  model3d?: Model3D;
  available: boolean;
};

export type Category = {
  id: string;
  name: string;
};

export type Restaurant = {
  slug: string;
  name: string;
  tagline: string;
  logoInitial: string;
  tableCount: number;
  categories: Category[];
  dishes: Dish[];
};

export type OrderItem = {
  dishId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
};

export type OrderStatus = "nuevo" | "en_preparacion" | "listo" | "entregado";

export type Order = {
  id: string;
  restaurantSlug: string;
  table: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
};
