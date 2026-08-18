/**
 * Tipos del esquema de Postgres. Es el archivo que usa la aplicación.
 *
 * Convive con `database.generated.ts`, que produce `npm run db:types` leyendo la
 * base real. Ese archivo es la referencia para comprobar que estos tipos siguen
 * en sintonía con el esquema; NO se usa directamente, por una razón concreta:
 * Postgres no puede demostrar que una columna de vista sea NOT NULL, así que el
 * generador las marca todas como nulas. Adoptarlo tal cual llenaría el código de
 * comprobaciones de null imposibles (`qty_available` nunca es nulo: es una
 * columna generada sobre dos columnas NOT NULL).
 *
 * Aquí solo se declara nulo lo que puede serlo de verdad: los datos del cliente,
 * la fecha de vencimiento (nula en crédito, que no vence) y los campos que
 * vienen de LEFT JOIN.
 *
 * Al cambiar el esquema: `npm run db:types` y comparar contra este archivo.
 *
 * Fíjate en que `Insert` y `Update` son `never` en TODAS las tablas: no es un
 * descuido, es la política de seguridad del proyecto expresada en el sistema de
 * tipos. El navegador no escribe directo en ninguna tabla; todo cambio pasa por
 * las funciones de `Functions`, que validan sesión, rol y reglas de negocio
 * dentro de una transacción. Si algún día ves un `.insert()` sobre una tabla,
 * TypeScript lo rechaza antes de que llegue a ejecutarse.
 */

export type UserRole = 'admin' | 'seller';
export type OrderType = 'contado' | 'apartado' | 'credito';
export type OrderStatus = 'open' | 'completed' | 'cancelled';
export type PriceKind = 'normal' | 'promo';
export type ReturnType = 'devolucion' | 'cambio';
export type PaymentStatus = 'pendiente' | 'parcial' | 'pagado' | 'cancelado';
export type AlertLevel = 'verde' | 'amarillo' | 'rojo';

export type PaymentMethod =
  | 'efectivo'
  | 'pago_movil'
  | 'zelle'
  | 'transferencia'
  | 'punto_venta'
  | 'otro'
  /** Interno: valor de la prenda devuelta en un cambio. No se elige a mano. */
  | 'credito_cambio';

export type StockReason =
  | 'purchase_in'
  | 'sale_out'
  | 'reserve'
  | 'release_reserve'
  | 'reserve_to_sale'
  | 'return_in'
  | 'adjustment';

/** Solo lectura: ninguna tabla admite escritura desde el cliente. */
type ReadOnly<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };

export type Profile = {
  id: string;
  full_name: string;
  /** Copiado desde auth.users por un trigger. Solo lo ven la propia persona y los admins. */
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Settings = {
  id: boolean;
  currency_code: string;
  timezone: string;
  layaway_min_deposit_pct: number;
  layaway_term_days: number;
  layaway_reminder_days: number;
  credit_min_deposit_pct: number;
  credit_reminder_days: number;
  low_stock_threshold: number;
  updated_at: string;
  updated_by: string | null;
}

export type Category = {
  id: string;
  name: string;
  created_at: string;
}

export type Product = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductVariant = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string;
  price_cents: number;
  qty_on_hand: number;
  qty_reserved: number;
  /** Columna generada por Postgres: `qty_on_hand - qty_reserved`. */
  qty_available: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  document_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type Order = {
  id: string;
  order_number: number;
  type: OrderType;
  status: OrderStatus;
  price_kind: PriceKind;
  customer_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  /** Solo los apartados vencen. En crédito es siempre null: plazo indefinido. */
  due_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export type OrderItem = {
  id: string;
  order_id: string;
  variant_id: string;
  qty: number;
  unit_list_price_cents: number;
  unit_price_cents: number;
  line_total_cents: number;
  product_name: string;
  variant_label: string;
}

export type Payment = {
  id: string;
  order_id: string;
  amount_cents: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paid_at: string;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export type Return = {
  id: string;
  return_number: number;
  order_id: string;
  type: ReturnType;
  refund_cents: number;
  refund_method: PaymentMethod | null;
  restocked: boolean;
  replacement_order_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Vistas                                                                      */
/* -------------------------------------------------------------------------- */

export type StockRow = {
  variant_id: string;
  product_id: string;
  product_name: string;
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  size: string;
  color: string;
  label: string;
  sku: string;
  price_cents: number;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  /** Queda poco, pero todavía se puede vender. NO incluye el cero. */
  is_low_stock: boolean;
  /** No queda nada disponible (lo apartado ya está descontado). */
  is_out_of_stock: boolean;
  is_active: boolean;
  product_is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderRow = {
  id: string;
  order_number: number;
  type: OrderType;
  status: OrderStatus;
  price_kind: PriceKind;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  payment_status: PaymentStatus;
  paid_pct: number;
  last_payment_at: string | null;
  due_date: string | null;
  notes: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  item_count: number;
}

export type OrderItemRow = {
  id: string;
  order_id: string;
  variant_id: string;
  product_name: string;
  variant_label: string;
  qty: number;
  unit_list_price_cents: number;
  unit_price_cents: number;
  line_total_cents: number;
  line_discount_cents: number;
  returned_qty: number;
}

export type OrderBalanceRow = {
  order_id: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  payment_status: PaymentStatus;
  paid_pct: number;
  payment_count: number;
  first_payment_at: string | null;
  last_payment_at: string | null;
}

export type CollectionRow = {
  order_id: string;
  order_number: number;
  type: Extract<OrderType, 'apartado' | 'credito'>;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  paid_pct: number;
  payment_status: PaymentStatus;
  last_payment_at: string | null;
  created_at: string;
  due_date: string | null;
  days_elapsed: number;
  /** Días que faltan para vencer. Null en crédito: no tiene vencimiento. */
  days_left: number | null;
  alert_level: AlertLevel;
  /** 0 rojo · 1 amarillo · 2 verde. Para ordenar de una sola pasada. */
  urgency_rank: number;
}

/* -------------------------------------------------------------------------- */
/* Retornos de funciones                                                       */
/* -------------------------------------------------------------------------- */

export type CashBucket = {
  bucket: string;
  in_cents: number;
  out_cents: number;
  net_cents: number;
  movements_in: number;
}

export type CashByMethod = {
  method: PaymentMethod;
  in_cents: number;
  out_cents: number;
  net_cents: number;
  movements: number;
}

export type ProfitBucket = {
  bucket: string;
  revenue_cents: number;
  cogs_cents: number;
  profit_cents: number;
  discount_given_cents: number;
  units_sold: number;
  orders_count: number;
}

export type TopProduct = {
  variant_id: string;
  label: string;
  sku: string;
  units_sold: number;
  revenue_cents: number;
  profit_cents: number;
}

export type DashboardSummary = {
  today: string;
  week_start: string;
  month_start: string;
  is_admin: boolean;
  collections: {
    red: number;
    yellow: number;
    green: number;
    layaway_count: number;
    credit_count: number;
    pending_cents: number;
  };
  low_stock: number;
  out_of_stock: number;
  /** Solo presente si quien consulta es admin. */
  cash?: { today: number; week: number; month: number } | undefined;
  /** Solo presente si quien consulta es admin. */
  profit?: { today: number; week: number; month: number } | undefined;
}

/* -------------------------------------------------------------------------- */
/* Argumentos de las funciones de escritura                                    */
/* -------------------------------------------------------------------------- */

export type OrderItemInput = {
  variant_id: string;
  qty: number;
  /** Solo en ventas de promoción. Si se omite, se usa el precio de lista. */
  unit_price_cents?: number | undefined;
}

export type PaymentInput = {
  amount_cents: number;
  method: Exclude<PaymentMethod, 'credito_cambio'>;
  reference?: string | undefined;
  notes?: string | undefined;
  paid_at?: string | undefined;
}

export type ReturnItemInput = {
  order_item_id: string;
  qty: number;
}

export type VariantInput = {
  size?: string | undefined;
  color?: string | undefined;
  sku?: string | undefined;
  price_cents: number;
  cost_cents?: number | undefined;
  qty?: number | undefined;
}

export type Database = {
  public: {
    Tables: {
      profiles: ReadOnly<Profile>;
      settings: ReadOnly<Settings>;
      categories: ReadOnly<Category>;
      products: ReadOnly<Product>;
      product_variants: ReadOnly<ProductVariant>;
      customers: ReadOnly<Customer>;
      orders: ReadOnly<Order>;
      order_items: ReadOnly<OrderItem>;
      payments: ReadOnly<Payment>;
      returns: ReadOnly<Return>;
      /** RLS: solo admin. */
      variant_costs: ReadOnly<{ variant_id: string; cost_cents: number; updated_at: string }>;
      /** RLS: solo admin. */
      order_item_costs: ReadOnly<{ order_item_id: string; unit_cost_cents: number }>;
    };
    Views: {
      v_stock: ReadOnly<StockRow>;
      v_orders: ReadOnly<OrderRow>;
      v_order_items: ReadOnly<OrderItemRow>;
      v_order_balances: ReadOnly<OrderBalanceRow>;
      v_collections_due: ReadOnly<CollectionRow>;
    };
    Functions: {
      create_order: {
        Args: {
          p_type: OrderType;
          p_items: OrderItemInput[];
          p_customer_id?: string | null | undefined;
          p_price_kind?: PriceKind | undefined;
          p_payments?: PaymentInput[] | undefined;
          p_discount_cents?: number | undefined;
          p_notes?: string | null | undefined;
        };
        Returns: string;
      };
      add_payment: {
        Args: {
          p_order_id: string;
          p_amount_cents: number;
          p_method: Exclude<PaymentMethod, 'credito_cambio'>;
          p_reference?: string | null | undefined;
          p_notes?: string | null | undefined;
          p_paid_at?: string | null | undefined;
        };
        Returns: string;
      };
      cancel_order: {
        Args: {
          p_order_id: string;
          p_restock?: boolean | undefined;
          p_refund_cents?: number | undefined;
          p_refund_method?: PaymentMethod | null | undefined;
          p_reason?: string | null | undefined;
        };
        Returns: undefined;
      };
      void_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      register_return: {
        Args: {
          p_order_id: string;
          p_items: ReturnItemInput[];
          p_restock?: boolean | undefined;
          p_refund_cents?: number | undefined;
          p_refund_method?: PaymentMethod | null | undefined;
          p_notes?: string | null | undefined;
        };
        Returns: string;
      };
      register_exchange: {
        Args: {
          p_order_id: string;
          p_returned_items: ReturnItemInput[];
          p_new_items: OrderItemInput[];
          p_payments?: PaymentInput[] | undefined;
          p_price_kind?: PriceKind | undefined;
          p_notes?: string | null | undefined;
        };
        Returns: string;
      };
      receive_stock: {
        Args: {
          p_variant_id: string;
          p_qty: number;
          p_unit_cost_cents?: number | null | undefined;
          p_note?: string | null | undefined;
        };
        Returns: undefined;
      };
      adjust_stock: {
        Args: { p_variant_id: string; p_delta: number; p_note: string };
        Returns: undefined;
      };
      create_product: {
        Args: {
          p_name: string;
          p_variants: VariantInput[];
          p_description?: string | null | undefined;
          p_brand?: string | null | undefined;
          p_category_id?: string | null | undefined;
        };
        Returns: string;
      };
      update_product: {
        Args: {
          p_id: string;
          p_name?: string | null | undefined;
          p_description?: string | null | undefined;
          p_brand?: string | null | undefined;
          p_category_id?: string | null | undefined;
          p_is_active?: boolean | null | undefined;
        };
        Returns: undefined;
      };
      create_variant: {
        Args: {
          p_product_id: string;
          p_price_cents: number;
          p_size?: string | undefined;
          p_color?: string | undefined;
          p_cost_cents?: number | undefined;
          p_qty?: number | undefined;
          p_sku?: string | null | undefined;
        };
        Returns: string;
      };
      update_variant: {
        Args: {
          p_id: string;
          p_size?: string | null | undefined;
          p_color?: string | null | undefined;
          p_price_cents?: number | null | undefined;
          p_cost_cents?: number | null | undefined;
          p_is_active?: boolean | null | undefined;
        };
        Returns: undefined;
      };
      upsert_category: { Args: { p_name: string; p_id?: string | null }; Returns: string };
      set_customer_active: { Args: { p_id: string; p_active: boolean }; Returns: undefined };
      delete_customer: { Args: { p_id: string }; Returns: undefined };
      upsert_customer: {
        Args: {
          p_full_name: string;
          p_id?: string | null | undefined;
          p_phone?: string | null | undefined;
          p_document_id?: string | null | undefined;
          p_notes?: string | null | undefined;
          p_is_active?: boolean | null | undefined;
        };
        Returns: string;
      };
      update_settings: {
        Args: {
          p_timezone?: string | null | undefined;
          p_layaway_min_deposit_pct?: number | null | undefined;
          p_layaway_term_days?: number | null | undefined;
          p_layaway_reminder_days?: number | null | undefined;
          p_credit_min_deposit_pct?: number | null | undefined;
          p_credit_reminder_days?: number | null | undefined;
          p_low_stock_threshold?: number | null | undefined;
        };
        Returns: undefined;
      };
      set_user_role: { Args: { p_user_id: string; p_role: UserRole }; Returns: undefined };
      set_user_active: { Args: { p_user_id: string; p_active: boolean }; Returns: undefined };
      report_cash: {
        Args: { p_from?: string | null; p_to?: string | null; p_granularity?: string };
        Returns: CashBucket[];
      };
      report_cash_by_method: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: CashByMethod[];
      };
      report_profit: {
        Args: { p_from?: string | null; p_to?: string | null; p_granularity?: string };
        Returns: ProfitBucket[];
      };
      report_top_products: {
        Args: { p_from?: string | null; p_to?: string | null; p_limit?: number };
        Returns: TopProduct[];
      };
      dashboard_summary: { Args: Record<string, never>; Returns: DashboardSummary };
      /** Helpers de rol. Se usan para cerrar la puerta antes de operaciones sensibles. */
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      auth_role: { Args: Record<string, never>; Returns: UserRole };
    };
    Enums: {
      user_role: UserRole;
      order_type: OrderType;
      order_status: OrderStatus;
      price_kind: PriceKind;
      payment_method: PaymentMethod;
      stock_reason: StockReason;
      return_type: ReturnType;
    };
    CompositeTypes: Record<string, never>;
  };
}
