import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// Version-CAS commits orders, budgets, stock, events and idempotency together.
export const workspaces = sqliteTable('workspaces', { ownerId: text('owner_id').primaryKey(), revision: integer('revision').notNull().default(0), data: text('data').notNull(), updatedAt: text('updated_at').notNull() });
