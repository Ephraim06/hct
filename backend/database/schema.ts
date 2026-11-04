import {pgTable, uuid, text, integer, boolean, timestamp,primaryKey} from 'drizzle-orm/pg-core';
export const galleryImages = pgTable('gallery_images', {
  id: uuid('id').primaryKey(), objectKey: text('object_key').notNull(),
  caption: text('caption').notNull(), alt: text('alt').notNull(), category: text('category').notNull(),
  width: integer('width').notNull(), height: integer('height').notNull(),
  sortOrder: integer('sort_order').notNull().default(0), published: boolean('published').notNull().default(false),
  archived: boolean('archived').notNull().default(false), createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', {withTimezone:true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone:true}).defaultNow().notNull(),
});
export const adminInvitations = pgTable('gallery_admins', {email:text('email').primaryKey(), createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()});

export const savedTours = pgTable('saved_tours', {
 userId:uuid('user_id').notNull(),tourSlug:text('tour_slug').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
},table=>[primaryKey({columns:[table.userId,table.tourSlug]})]);
