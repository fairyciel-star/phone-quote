export interface Database {
  public: {
    Tables: {
      phones: {
        Row: PhoneRow;
        Insert: Omit<PhoneRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PhoneRow, 'model_id'>>;
      };
      phone_variants: {
        Row: PhoneVariantRow;
        Insert: Omit<PhoneVariantRow, 'id'>;
        Update: Partial<Omit<PhoneVariantRow, 'id'>>;
      };
      carrier_subsidies: {
        Row: CarrierSubsidyRow;
        Insert: Omit<CarrierSubsidyRow, 'id' | 'updated_at'>;
        Update: Partial<Omit<CarrierSubsidyRow, 'id'>>;
      };
      installment_subsidies: {
        Row: InstallmentSubsidyRow;
        Insert: Omit<InstallmentSubsidyRow, 'id' | 'updated_at'>;
        Update: Partial<Omit<InstallmentSubsidyRow, 'id'>>;
      };
      plans: {
        Row: PlanRow;
        Insert: PlanRow;
        Update: Partial<PlanRow>;
      };
      card_discounts: {
        Row: CardDiscountRow;
        Insert: CardDiscountRow;
        Update: Partial<CardDiscountRow>;
      };
      extra_services: {
        Row: ExtraServiceRow;
        Insert: ExtraServiceRow;
        Update: Partial<ExtraServiceRow>;
      };
      used_prices: {
        Row: UsedPriceRow;
        Insert: Omit<UsedPriceRow, 'id' | 'updated_at'>;
        Update: Partial<Omit<UsedPriceRow, 'id'>>;
      };
      stores: {
        Row: StoreRow;
        Insert: Omit<StoreRow, 'id' | 'created_at'>;
        Update: Partial<Omit<StoreRow, 'id'>>;
      };
      store_rebates: {
        Row: StoreRebateRow;
        Insert: Omit<StoreRebateRow, 'id' | 'updated_at'>;
        Update: Partial<Omit<StoreRebateRow, 'id'>>;
      };
      price_upload_logs: {
        Row: PriceUploadLogRow;
        Insert: Omit<PriceUploadLogRow, 'id' | 'created_at'>;
        Update: Partial<Omit<PriceUploadLogRow, 'id'>>;
      };
    };
  };
}

export interface PhoneRow {
  readonly model_id: string;
  readonly manufacturer: string;
  readonly model_name: string;
  readonly badge: string;
  readonly is_kids: boolean;
  readonly image_url: string;
  readonly release_date: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PhoneVariantRow {
  readonly id: number;
  readonly model_id: string;
  readonly storage: string;
  readonly retail_price: number;
  readonly color_name: string;
  readonly color_hex: string;
  readonly color_image_url: string;
}

export interface CarrierSubsidyRow {
  readonly id: number;
  readonly model_id: string;
  readonly carrier: string;
  readonly storage: string;
  readonly subscription_type: string;
  readonly high_subsidy: number;
  readonly high_additional: number;
  readonly high_special: number;
  readonly mid_subsidy: number;
  readonly mid_additional: number;
  readonly mid_special: number;
  readonly low_subsidy: number;
  readonly low_additional: number;
  readonly low_special: number;
  readonly updated_at: string;
}

export interface InstallmentSubsidyRow {
  readonly id: number;
  readonly model_id: string;
  readonly carrier: string;
  readonly storage: string;
  readonly subscription_type: string;
  readonly high_additional: number;
  readonly high_special: number;
  readonly mid_additional: number;
  readonly mid_special: number;
  readonly low_additional: number;
  readonly low_special: number;
  readonly updated_at: string;
}

export interface PlanRow {
  readonly id: string;
  readonly carrier: string;
  readonly plan_name: string;
  readonly monthly_fee: number;
  readonly data: string;
  readonly calls: string;
  readonly texts: string;
  readonly discount_rate: number;
  readonly benefits: string;
  readonly exclusive_plan: string;
  readonly tier: string;
  readonly category: string;
  readonly created_at: string;
}

export interface CardDiscountRow {
  readonly id: string;
  readonly carrier: string;
  readonly card_name: string;
  readonly monthly_discount: number;
  readonly conditions: string;
}

export interface ExtraServiceRow {
  readonly id: string;
  readonly carrier: string;
  readonly service_name: string;
  readonly monthly_fee: number;
  readonly additional_discount: number;
  readonly description: string;
}

export interface UsedPriceRow {
  readonly id: number;
  readonly model_name: string;
  readonly model_id: string;
  readonly storage: string;
  readonly grade_a: number;
  readonly grade_b: number;
  readonly grade_c: number;
  readonly grade_e: number;
  readonly updated_at: string;
}

export interface StoreRow {
  readonly id: string;
  readonly store_name: string;
  readonly owner_name: string;
  readonly carrier: string;
  readonly phone: string;
  readonly email: string;
  readonly is_active: boolean;
  readonly created_at: string;
}

export interface StoreRebateRow {
  readonly id: number;
  readonly store_id: string;
  readonly model_id: string;
  readonly carrier: string;
  readonly storage: string;
  readonly subscription_type: string;
  readonly plan_tier: string;
  readonly subsidy_rebate: number;
  readonly installment_rebate: number;
  readonly updated_at: string;
}

export interface PriceUploadLogRow {
  readonly id: number;
  readonly carrier: string;
  readonly image_url: string;
  readonly rows_updated: number;
  readonly uploaded_by: string;
  readonly created_at: string;
}
