-- Admin-managed labels under Stay / Eat / Move / Explore / Meet
CREATE TABLE IF NOT EXISTS "CategoryLabel" (
  "id" TEXT PRIMARY KEY,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("category", "slug")
);

CREATE INDEX IF NOT EXISTS "CategoryLabel_category_idx" ON "CategoryLabel"("category");
CREATE INDEX IF NOT EXISTS "CategoryLabel_isActive_idx" ON "CategoryLabel"("isActive");

INSERT INTO "CategoryLabel" ("id", "category", "name", "slug", "sortOrder", "isActive") VALUES
  ('cl_stay_bnb', 'STAY', 'BnB', 'bnb', 10, true),
  ('cl_stay_hotel', 'STAY', 'Hotel', 'hotel', 20, true),
  ('cl_stay_lodge', 'STAY', 'Lodge', 'lodge', 30, true),
  ('cl_stay_resort', 'STAY', 'Resort', 'resort', 40, true),
  ('cl_stay_campsite', 'STAY', 'Campsite', 'campsite', 50, true),
  ('cl_stay_spa', 'STAY', 'Spa', 'spa', 60, true),
  ('cl_eat_restaurant', 'EAT', 'Restaurant', 'restaurant', 10, true),
  ('cl_eat_cafe', 'EAT', 'Café', 'cafe', 20, true),
  ('cl_eat_bar', 'EAT', 'Bar', 'bar', 30, true),
  ('cl_eat_pool', 'EAT', 'Pool club', 'pool-club', 40, true),
  ('cl_move_car', 'MOVE', 'Car hire', 'car-hire', 10, true),
  ('cl_move_airport', 'MOVE', 'Airport transfer', 'airport-transfer', 20, true),
  ('cl_explore_guide', 'EXPLORE', 'Tour guide', 'tour-guide', 10, true),
  ('cl_explore_operator', 'EXPLORE', 'Tour operator', 'tour-operator', 20, true),
  ('cl_explore_safari', 'EXPLORE', 'Safari company', 'safari-company', 30, true),
  ('cl_explore_day', 'EXPLORE', 'Day tour', 'day-tour', 40, true),
  ('cl_explore_package', 'EXPLORE', 'Safari package', 'safari-package', 50, true),
  ('cl_explore_city', 'EXPLORE', 'City experience', 'city-experience', 60, true),
  ('cl_explore_workshop', 'EXPLORE', 'Workshop / class', 'workshop-class', 70, true),
  ('cl_explore_cinema', 'EXPLORE', 'Cinema', 'cinema', 80, true),
  ('cl_explore_bowling', 'EXPLORE', 'Bowling', 'bowling', 90, true),
  ('cl_meet_conference', 'MEET', 'Conference venue', 'conference-venue', 10, true),
  ('cl_meet_event', 'MEET', 'Event space', 'event-space', 20, true),
  ('cl_meet_festival', 'MEET', 'Festival / concert', 'festival-concert', 30, true),
  ('cl_meet_private', 'MEET', 'Private event', 'private-event', 40, true)
ON CONFLICT ("id") DO NOTHING;

-- Shared facilities (also see 2026-category-amenities-seed.sql for extras)
INSERT INTO "CategoryLabel" ("id", "category", "name", "slug", "sortOrder", "isActive") VALUES
  ('cl_all_wifi', 'ALL', 'Wi‑Fi', 'wifi', 10, true),
  ('cl_all_parking', 'ALL', 'Parking', 'parking', 20, true),
  ('cl_all_ac', 'ALL', 'Air conditioning', 'air_conditioning', 30, true),
  ('cl_all_garden', 'ALL', 'Garden / outdoor seating', 'garden', 40, true),
  ('cl_all_kids', 'ALL', 'Kids play area', 'kids_play', 50, true),
  ('cl_all_pet', 'ALL', 'Pet friendly', 'pet_friendly', 60, true),
  ('cl_all_wheelchair', 'ALL', 'Wheelchair accessible', 'wheelchair', 70, true),
  ('cl_all_generator', 'ALL', 'Backup power', 'generator', 80, true),
  ('cl_all_restaurant', 'ALL', 'Restaurant', 'restaurant', 90, true),
  ('cl_all_bar', 'ALL', 'Bar / lounge', 'bar', 100, true),
  ('cl_all_pool', 'ALL', 'Swimming pool', 'swimming_pool', 110, true)
ON CONFLICT ("id") DO NOTHING;
