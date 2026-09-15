export type Model3D = {
  /** glTF binario. Alimenta el visor 3D y el AR de Android (Scene Viewer). */
  glb: string;
  /** USDZ. Necesario para el AR nativo de iPhone (Quick Look). Opcional. */
  usdz?: string;
  /** Medidas reales del plato servido, en cm. Se muestran junto al visor. */
  medidas?: { ancho: number; alto: number };
};

/** Alérgenos frecuentes, nombrados como los pregunta un comensal. */
export type Alergeno =
  | "gluten"
  | "lacteos"
  | "mariscos"
  | "pescado"
  | "huevo"
  | "frutos secos"
  | "soya"
  | "alcohol";

export type Dieta = "vegetariano" | "vegano" | "sin gluten" | "sin lacteos";

export type Dish = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  tags?: string[];
  portion?: string;
  model3d?: Model3D;
  available: boolean;

  // --- conocimiento que el asistente usa para responder ---

  /** Ingredientes principales, en lenguaje de comensal. */
  ingredientes: string[];
  /** Alérgenos presentes. Responde "¿tiene gluten?". */
  alergenos: Alergeno[];
  /** Dietas que este plato satisface. */
  dietas?: Dieta[];
  /** 0 = nada picante, 3 = muy picante. */
  picante: 0 | 1 | 2 | 3;
  /** Si el picante se puede omitir o ajustar al pedir. */
  picanteOpcional?: boolean;
  /** Minutos aproximados de preparación. */
  minutos: number;
  /** Cuántas personas satisface cómodamente. */
  personas: number;
  /** Descriptores de sabor y textura: "cítrico", "ahumado", "cremoso". */
  perfil: string[];
  /** IDs de platos que combinan bien. Alimenta las sugerencias al pedir. */
  combina?: string[];
  /** Nota del cocinero: el dato que daría un buen mesero. */
  nota?: string;
  /** Otras formas de nombrar el plato, para entender preguntas. */
  alias?: string[];
};

export type Category = {
  id: string;
  name: string;
  /**
   * Nombre corto para la barra de navegación. Cuatro secciones en
   * versalitas con letter-spacing amplio no caben en la pantalla de un
   * teléfono; el nombre largo se queda para el encabezado de la sección,
   * donde sí hay sitio.
   */
  nav?: string;
  /** Línea corta que encabeza la sección del menú. */
  intro?: string;
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
