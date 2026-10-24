import { mysqlTable, varchar, text, int, timestamp, decimal, boolean, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/**
 * 01. Users Table
 * System users across all roles: super_admin, ops_manager, warehouse_staff, sales_team, support_agent, customer
 */
export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  role: varchar('role', { length: 50 }).notNull().default('customer'),
  status: varchar('status', { length: 30 }).notNull().default('active'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 02. Sessions Table
 * Server-side session lifecycle management
 */
export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 03. Roles and Permissions Table
 * Role-Based Access Control matrix
 */
export const rolesPermissions = mysqlTable('roles_permissions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  role: varchar('role', { length: 50 }).notNull(),
  permission: varchar('permission', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 04. Customers Table
 * Extended business / individual customer profiles
 */
export const customers = mysqlTable('customers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  companyName: varchar('company_name', { length: 255 }),
  taxId: varchar('tax_id', { length: 100 }),
  tradeLicense: varchar('trade_license', { length: 100 }),
  contactPerson: varchar('contact_person', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  billingAddress: text('billing_address'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).notNull().default('Bangladesh'),
  postalCode: varchar('postal_code', { length: 30 }),
  accountType: varchar('account_type', { length: 30 }).default('corporate'), // corporate, individual
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 05. Warehouses Table
 * Global hubs, receiving & consolidation facilities
 */
export const warehouses = mysqlTable('warehouses', {
  id: varchar('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(), // e.g., DAC-HUB, CTG-PORT, DXB-AIR
  name: varchar('name', { length: 255 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  address: text('address').notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  capacitySqft: int('capacity_sqft').default(10000),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 06. Shipments Table
 * Master shipment records
 */
export const shipments = mysqlTable('shipments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  trackingNumber: varchar('tracking_number', { length: 50 }).notNull().unique(), // e.g. GOSH-2026-9812
  customerId: varchar('customer_id', { length: 36 }).references(() => customers.id),
  originWarehouseId: varchar('origin_warehouse_id', { length: 36 }).references(() => warehouses.id),
  destWarehouseId: varchar('dest_warehouse_id', { length: 36 }).references(() => warehouses.id),
  originCountry: varchar('origin_country', { length: 100 }).notNull(),
  originCity: varchar('origin_city', { length: 100 }).notNull(),
  destCountry: varchar('dest_country', { length: 100 }).notNull(),
  destCity: varchar('dest_city', { length: 100 }).notNull(),
  mode: varchar('mode', { length: 30 }).notNull().default('air'), // air, sea, road, multimodal
  serviceLevel: varchar('service_level', { length: 50 }).notNull().default('standard'), // express, standard, priority
  status: varchar('status', { length: 50 }).notNull().default('warehouse_received'),
  // Possible statuses: warehouse_received, in_transit, customs_clearance, out_for_delivery, delivered, on_hold, cancelled
  currentLocation: varchar('current_location', { length: 255 }),
  currentLat: decimal('current_lat', { precision: 10, scale: 7 }),
  currentLng: decimal('current_lng', { precision: 10, scale: 7 }),
  totalWeightKg: decimal('total_weight_kg', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalCbm: decimal('total_cbm', { precision: 10, scale: 3 }).notNull().default('0.000'),
  totalPieces: int('total_pieces').notNull().default(1),
  carrierName: varchar('carrier_name', { length: 100 }),
  carrierWaybillNumber: varchar('carrier_waybill_number', { length: 100 }),
  estimatedDelivery: timestamp('estimated_delivery'),
  actualDelivery: timestamp('actual_delivery'),
  bookingReference: varchar('booking_reference', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 07. Shipment Events Table
 * Verified chronological tracking events and location history
 */
export const shipmentEvents = mysqlTable('shipment_events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  shipmentId: varchar('shipment_id', { length: 36 }).notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  eventTime: timestamp('event_time').notNull(),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  source: varchar('source', { length: 50 }).default('warehouse'), // warehouse, admin, carrier_api, driver
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 08. Shipment Items Table
 * Cargo package items, quantities, dimensions & descriptions
 */
export const shipmentItems = mysqlTable('shipment_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  shipmentId: varchar('shipment_id', { length: 36 }).notNull().references(() => shipments.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: int('quantity').notNull().default(1),
  packagingType: varchar('packaging_type', { length: 50 }).default('carton'), // carton, pallet, crate, drum
  weightKg: decimal('weight_kg', { precision: 10, scale: 2 }).notNull().default('0.00'),
  lengthCm: decimal('length_cm', { precision: 10, scale: 2 }),
  widthCm: decimal('width_cm', { precision: 10, scale: 2 }),
  heightCm: decimal('height_cm', { precision: 10, scale: 2 }),
  cbm: decimal('cbm', { precision: 10, scale: 3 }).notNull().default('0.000'),
  hsCode: varchar('hs_code', { length: 50 }),
  declaredValue: decimal('declared_value', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('USD'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 09. Quotes Table
 * Quotation requests, lifecycle statuses and assignment
 */
export const quotes = mysqlTable('quotes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  quoteNumber: varchar('quote_number', { length: 50 }).notNull().unique(), // e.g. QTE-2026-4401
  customerId: varchar('customer_id', { length: 36 }).references(() => customers.id),
  guestName: varchar('guest_name', { length: 255 }),
  guestEmail: varchar('guest_email', { length: 255 }),
  guestPhone: varchar('guest_phone', { length: 50 }),
  originCountry: varchar('origin_country', { length: 100 }).notNull(),
  originCity: varchar('origin_city', { length: 100 }).notNull(),
  destCountry: varchar('dest_country', { length: 100 }).notNull(),
  destCity: varchar('dest_city', { length: 100 }).notNull(),
  mode: varchar('mode', { length: 30 }).notNull().default('air'), // air, sea
  serviceType: varchar('service_type', { length: 50 }).default('port_to_port'), // door_to_door, port_to_port, door_to_port
  cargoDescription: text('cargo_description').notNull(),
  packagingType: varchar('packaging_type', { length: 50 }).default('carton'),
  quantity: int('quantity').default(1),
  totalWeightKg: decimal('total_weight_kg', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalCbm: decimal('total_cbm', { precision: 10, scale: 3 }).notNull().default('0.000'),
  status: varchar('status', { length: 50 }).notNull().default('submitted'),
  // submitted, under_review, priced, accepted, revision_requested, declined, converted_to_shipment
  targetShipmentDate: timestamp('target_shipment_date'),
  validityDate: timestamp('validity_date'),
  assignedStaffId: varchar('assigned_staff_id', { length: 36 }).references(() => users.id),
  convertedShipmentId: varchar('converted_shipment_id', { length: 36 }).references(() => shipments.id),
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 10. Quote Revisions Table
 * Versioned pricing details, breakdowns and terms
 */
export const quoteRevisions = mysqlTable('quote_revisions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  quoteId: varchar('quote_id', { length: 36 }).notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  revisionNumber: int('revision_number').notNull().default(1),
  baseFreightCharge: decimal('base_freight_charge', { precision: 12, scale: 2 }).notNull().default('0.00'),
  fuelSurcharge: decimal('fuel_surcharge', { precision: 12, scale: 2 }).default('0.00'),
  customsClearanceFee: decimal('customs_clearance_fee', { precision: 12, scale: 2 }).default('0.00'),
  handlingFee: decimal('handling_fee', { precision: 12, scale: 2 }).default('0.00'),
  insuranceFee: decimal('insurance_fee', { precision: 12, scale: 2 }).default('0.00'),
  otherFees: decimal('other_fees', { precision: 12, scale: 2 }).default('0.00'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  validityDate: timestamp('validity_date'),
  transitTimeDays: varchar('transit_time_days', { length: 50 }),
  notes: text('notes'),
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 11. Quote Items Table
 * Granular charge line items per quotation revision
 */
export const quoteItems = mysqlTable('quote_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  quoteId: varchar('quote_id', { length: 36 }).notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  revisionId: varchar('revision_id', { length: 36 }).notNull().references(() => quoteRevisions.id, { onDelete: 'cascade' }),
  itemType: varchar('item_type', { length: 50 }).default('freight'), // freight, surcharge, customs, storage
  description: varchar('description', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1.00'),
  unitRate: decimal('unit_rate', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 12. Documents Table
 * Protected document records (Airway Bills, Invoices, Customs Decs)
 */
export const documents = mysqlTable('documents', {
  id: varchar('id', { length: 36 }).primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // shipment, quote, customer
  entityId: varchar('entity_id', { length: 36 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileSize: int('file_size').notNull().default(0), // bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(), // invoice, airway_bill, bill_of_lading, packing_list, customs_doc
  uploadedByUserId: varchar('uploaded_by_user_id', { length: 36 }).references(() => users.id),
  isProtected: boolean('is_protected').notNull().default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 13. Notifications Table
 * User-facing alerts and notification history
 */
export const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).default('shipment_update'), // shipment_update, quote_update, invoice, system
  link: varchar('link', { length: 255 }),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 14. Audit Logs Table
 * Tamper-evident admin & system event logs
 */
export const auditLogs = mysqlTable('audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 36 }),
  details: json('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 15. Site Content Table
 * Dynamic website content, announcements & FAQs
 */
export const siteContent = mysqlTable('site_content', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sectionKey: varchar('section_key', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  locale: varchar('locale', { length: 10 }).notNull().default('en'),
  isPublished: boolean('is_published').notNull().default(true),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 16. System Settings Table
 * Rates, default currency, API keys and operational settings
 */
export const systemSettings = mysqlTable('system_settings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  settingKey: varchar('setting_key', { length: 100 }).notNull().unique(),
  settingValue: text('setting_value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});
