export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_costs: {
        Row: {
          order_item_id: string
          unit_cost_cents: number
        }
        Insert: {
          order_item_id: string
          unit_cost_cents?: number
        }
        Update: {
          order_item_id?: string
          unit_cost_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_costs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_costs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "v_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total_cents: number
          order_id: string
          product_name: string
          qty: number
          unit_list_price_cents: number
          unit_price_cents: number
          variant_id: string
          variant_label: string
        }
        Insert: {
          id?: string
          line_total_cents: number
          order_id: string
          product_name: string
          qty: number
          unit_list_price_cents: number
          unit_price_cents: number
          variant_id: string
          variant_label: string
        }
        Update: {
          id?: string
          line_total_cents?: number
          order_id?: string
          product_name?: string
          qty?: number
          unit_list_price_cents?: number
          unit_price_cents?: number
          variant_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_collections_due"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balances"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_margin"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          discount_cents: number
          due_date: string | null
          id: string
          notes: string | null
          order_number: number
          price_kind: Database["public"]["Enums"]["price_kind"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          type: Database["public"]["Enums"]["order_type"]
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount_cents?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          price_kind?: Database["public"]["Enums"]["price_kind"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          type: Database["public"]["Enums"]["order_type"]
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_cents?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          price_kind?: Database["public"]["Enums"]["price_kind"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          type?: Database["public"]["Enums"]["order_type"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          order_id: string
          paid_at: string
          reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id: string
          paid_at?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          order_id?: string
          paid_at?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_collections_due"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balances"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_margin"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          price_cents: number
          product_id: string
          qty_available: number | null
          qty_on_hand: number
          qty_reserved: number
          size: string
          sku: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          price_cents: number
          product_id: string
          qty_available?: number | null
          qty_on_hand?: number
          qty_reserved?: number
          size?: string
          sku: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          price_cents?: number
          product_id?: string
          qty_available?: number | null
          qty_on_hand?: number
          qty_reserved?: number
          size?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      return_items: {
        Row: {
          id: string
          order_item_id: string
          qty: number
          return_id: string
        }
        Insert: {
          id?: string
          order_item_id: string
          qty: number
          return_id: string
        }
        Update: {
          id?: string
          order_item_id?: string
          qty?: number
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          order_id: string
          refund_cents: number
          refund_method: Database["public"]["Enums"]["payment_method"] | null
          replacement_order_id: string | null
          restocked: boolean
          return_number: number
          type: Database["public"]["Enums"]["return_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          order_id: string
          refund_cents?: number
          refund_method?: Database["public"]["Enums"]["payment_method"] | null
          replacement_order_id?: string | null
          restocked?: boolean
          return_number?: number
          type: Database["public"]["Enums"]["return_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          order_id?: string
          refund_cents?: number
          refund_method?: Database["public"]["Enums"]["payment_method"] | null
          replacement_order_id?: string | null
          restocked?: boolean
          return_number?: number
          type?: Database["public"]["Enums"]["return_type"]
        }
        Relationships: [
          {
            foreignKeyName: "returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_collections_due"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balances"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_margin"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "v_collections_due"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "returns_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balances"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "returns_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "v_order_margin"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "returns_replacement_order_id_fkey"
            columns: ["replacement_order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          credit_min_deposit_pct: number
          credit_reminder_days: number
          currency_code: string
          id: boolean
          layaway_min_deposit_pct: number
          layaway_reminder_days: number
          layaway_term_days: number
          low_stock_threshold: number
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credit_min_deposit_pct?: number
          credit_reminder_days?: number
          currency_code?: string
          id?: boolean
          layaway_min_deposit_pct?: number
          layaway_reminder_days?: number
          layaway_term_days?: number
          low_stock_threshold?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credit_min_deposit_pct?: number
          credit_reminder_days?: number
          currency_code?: string
          id?: boolean
          layaway_min_deposit_pct?: number
          layaway_reminder_days?: number
          layaway_term_days?: number
          low_stock_threshold?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta_on_hand: number
          delta_reserved: number
          id: number
          note: string | null
          order_id: string | null
          reason: Database["public"]["Enums"]["stock_reason"]
          return_id: string | null
          unit_cost_cents: number | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta_on_hand?: number
          delta_reserved?: number
          id?: never
          note?: string | null
          order_id?: string | null
          reason: Database["public"]["Enums"]["stock_reason"]
          return_id?: string | null
          unit_cost_cents?: number | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta_on_hand?: number
          delta_reserved?: number
          id?: never
          note?: string | null
          order_id?: string | null
          reason?: Database["public"]["Enums"]["stock_reason"]
          return_id?: string | null
          unit_cost_cents?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_collections_due"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balances"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_margin"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      variant_costs: {
        Row: {
          cost_cents: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cost_cents?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cost_cents?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_costs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "v_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
    }
    Views: {
      v_cash_daily: {
        Row: {
          in_cents: number | null
          local_date: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          movements_in: number | null
          movements_out: number | null
          net_cents: number | null
          out_cents: number | null
        }
        Relationships: []
      }
      v_cash_movements: {
        Row: {
          amount_cents: number | null
          created_by: string | null
          local_date: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          occurred_at: string | null
          order_id: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          source: string | null
          source_id: string | null
        }
        Relationships: []
      }
      v_catalogo_publico: {
        Row: {
          brand: string | null
          category_name: string | null
          color: string | null
          images: Json | null
          is_available: boolean | null
          price_from_cents: number | null
          product_id: string | null
          product_name: string | null
          sizes_available: string[] | null
        }
        Relationships: []
      }
      v_collections_due: {
        Row: {
          alert_level: string | null
          balance_cents: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          days_elapsed: number | null
          days_left: number | null
          due_date: string | null
          last_payment_at: string | null
          order_id: string | null
          order_number: number | null
          paid_cents: number | null
          paid_pct: number | null
          payment_status: string | null
          total_cents: number | null
          type: Database["public"]["Enums"]["order_type"] | null
          urgency_rank: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_balances: {
        Row: {
          balance_cents: number | null
          first_payment_at: string | null
          last_payment_at: string | null
          order_id: string | null
          paid_cents: number | null
          paid_pct: number | null
          payment_count: number | null
          payment_status: string | null
          total_cents: number | null
        }
        Relationships: []
      }
      v_order_items: {
        Row: {
          id: string | null
          line_discount_cents: number | null
          line_total_cents: number | null
          order_id: string | null
          product_name: string | null
          qty: number | null
          returned_qty: number | null
          unit_list_price_cents: number | null
          unit_price_cents: number | null
          variant_id: string | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_collections_due"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balances"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_margin"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      v_order_margin: {
        Row: {
          cogs_cents: number | null
          discount_given_cents: number | null
          goods_out_at: string | null
          local_date: string | null
          order_id: string | null
          order_number: number | null
          price_kind: Database["public"]["Enums"]["price_kind"] | null
          profit_cents: number | null
          revenue_cents: number | null
          type: Database["public"]["Enums"]["order_type"] | null
          units_sold: number | null
        }
        Relationships: []
      }
      v_orders: {
        Row: {
          balance_cents: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_cents: number | null
          due_date: string | null
          id: string | null
          item_count: number | null
          last_payment_at: string | null
          notes: string | null
          order_number: number | null
          paid_cents: number | null
          paid_pct: number | null
          payment_status: string | null
          price_kind: Database["public"]["Enums"]["price_kind"] | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal_cents: number | null
          total_cents: number | null
          type: Database["public"]["Enums"]["order_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_profit_daily: {
        Row: {
          cogs_cents: number | null
          discount_given_cents: number | null
          local_date: string | null
          orders_count: number | null
          profit_cents: number | null
          revenue_cents: number | null
          units_sold: number | null
        }
        Relationships: []
      }
      v_stock: {
        Row: {
          brand: string | null
          category_id: string | null
          category_name: string | null
          color: string | null
          created_at: string | null
          is_active: boolean | null
          is_low_stock: boolean | null
          is_out_of_stock: boolean | null
          label: string | null
          price_cents: number | null
          product_id: string | null
          product_is_active: boolean | null
          product_name: string | null
          qty_available: number | null
          qty_on_hand: number | null
          qty_reserved: number | null
          size: string | null
          sku: string | null
          updated_at: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_payment: {
        Args: {
          p_amount_cents: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_order_id: string
          p_paid_at?: string
          p_reference?: string
        }
        Returns: string
      }
      adjust_stock: {
        Args: { p_delta: number; p_note: string; p_variant_id: string }
        Returns: undefined
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      cancel_order: {
        Args: {
          p_order_id: string
          p_reason?: string
          p_refund_cents?: number
          p_refund_method?: Database["public"]["Enums"]["payment_method"]
          p_restock?: boolean
        }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_customer_id?: string
          p_discount_cents?: number
          p_items: Json
          p_notes?: string
          p_payments?: Json
          p_price_kind?: Database["public"]["Enums"]["price_kind"]
          p_type: Database["public"]["Enums"]["order_type"]
        }
        Returns: string
      }
      create_product: {
        Args: {
          p_brand?: string
          p_category_id?: string
          p_description?: string
          p_images?: Json
          p_name: string
          p_variants: Json
        }
        Returns: string
      }
      create_variant: {
        Args: {
          p_color?: string
          p_cost_cents?: number
          p_price_cents: number
          p_product_id: string
          p_qty?: number
          p_size?: string
          p_sku?: string
        }
        Returns: string
      }
      dashboard_summary: { Args: never; Returns: Json }
      delete_category: { Args: { p_id: string }; Returns: undefined }
      delete_customer: { Args: { p_id: string }; Returns: undefined }
      format_cents: { Args: { p_cents: number }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      receive_stock: {
        Args: {
          p_note?: string
          p_qty: number
          p_unit_cost_cents?: number
          p_variant_id: string
        }
        Returns: undefined
      }
      register_exchange: {
        Args: {
          p_new_items: Json
          p_notes?: string
          p_order_id: string
          p_payments?: Json
          p_price_kind?: Database["public"]["Enums"]["price_kind"]
          p_returned_items: Json
        }
        Returns: string
      }
      register_return: {
        Args: {
          p_items: Json
          p_notes?: string
          p_order_id: string
          p_refund_cents?: number
          p_refund_method?: Database["public"]["Enums"]["payment_method"]
          p_restock?: boolean
        }
        Returns: string
      }
      report_cash: {
        Args: { p_from?: string; p_granularity?: string; p_to?: string }
        Returns: {
          bucket: string
          in_cents: number
          movements_in: number
          net_cents: number
          out_cents: number
        }[]
      }
      report_cash_by_method: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          in_cents: number
          method: Database["public"]["Enums"]["payment_method"]
          movements: number
          net_cents: number
          out_cents: number
        }[]
      }
      report_profit: {
        Args: { p_from?: string; p_granularity?: string; p_to?: string }
        Returns: {
          bucket: string
          cogs_cents: number
          discount_given_cents: number
          orders_count: number
          profit_cents: number
          revenue_cents: number
          units_sold: number
        }[]
      }
      report_top_products: {
        Args: { p_from?: string; p_limit?: number; p_to?: string }
        Returns: {
          label: string
          profit_cents: number
          revenue_cents: number
          sku: string
          units_sold: number
          variant_id: string
        }[]
      }
      require_admin: { Args: never; Returns: string }
      require_staff: { Args: never; Returns: string }
      set_customer_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      set_user_active: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      update_product: {
        Args: {
          p_brand?: string
          p_category_id?: string
          p_description?: string
          p_id: string
          p_is_active?: boolean
          p_name?: string
        }
        Returns: undefined
      }
      update_settings: {
        Args: {
          p_credit_min_deposit_pct?: number
          p_credit_reminder_days?: number
          p_layaway_min_deposit_pct?: number
          p_layaway_reminder_days?: number
          p_layaway_term_days?: number
          p_low_stock_threshold?: number
          p_timezone?: string
        }
        Returns: undefined
      }
      update_variant: {
        Args: {
          p_color?: string
          p_cost_cents?: number
          p_id: string
          p_is_active?: boolean
          p_price_cents?: number
          p_size?: string
        }
        Returns: undefined
      }
      upsert_category: {
        Args: { p_id?: string; p_name: string }
        Returns: string
      }
      upsert_customer: {
        Args: {
          p_document_id?: string
          p_full_name: string
          p_id?: string
          p_is_active?: boolean
          p_notes?: string
          p_phone?: string
        }
        Returns: string
      }
      void_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      order_status: "open" | "completed" | "cancelled"
      order_type: "contado" | "apartado" | "credito"
      payment_method:
        | "efectivo"
        | "pago_movil"
        | "zelle"
        | "transferencia"
        | "punto_venta"
        | "otro"
        | "credito_cambio"
      price_kind: "normal" | "promo"
      return_type: "devolucion" | "cambio"
      stock_reason:
        | "purchase_in"
        | "sale_out"
        | "reserve"
        | "release_reserve"
        | "reserve_to_sale"
        | "return_in"
        | "adjustment"
      user_role: "admin" | "seller"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: ["open", "completed", "cancelled"],
      order_type: ["contado", "apartado", "credito"],
      payment_method: [
        "efectivo",
        "pago_movil",
        "zelle",
        "transferencia",
        "punto_venta",
        "otro",
        "credito_cambio",
      ],
      price_kind: ["normal", "promo"],
      return_type: ["devolucion", "cambio"],
      stock_reason: [
        "purchase_in",
        "sale_out",
        "reserve",
        "release_reserve",
        "reserve_to_sale",
        "return_in",
        "adjustment",
      ],
      user_role: ["admin", "seller"],
    },
  },
} as const
