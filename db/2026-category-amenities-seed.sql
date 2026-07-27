-- Shared + category amenities (labels renamed → amenities in product UI)
-- Safe to re-run: ON CONFLICT DO NOTHING

INSERT INTO "CategoryLabel" ("id", "category", "name", "slug", "sortOrder", "isActive") VALUES
  -- Shared across categories
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
  ('cl_all_pool', 'ALL', 'Swimming pool', 'swimming_pool', 110, true),

  -- Stay facilities
  ('cl_stay_wifi', 'STAY', 'Room service', 'room_service', 200, true),
  ('cl_stay_laundry', 'STAY', 'Laundry', 'laundry', 210, true),
  ('cl_stay_gym', 'STAY', 'Gym / fitness', 'gym', 220, true),
  ('cl_stay_sauna', 'STAY', 'Sauna / steam', 'sauna', 230, true),
  ('cl_stay_security', 'STAY', '24h security', 'security', 240, true),
  ('cl_stay_shuttle', 'STAY', 'Airport shuttle', 'airport_shuttle', 250, true),
  ('cl_stay_ev', 'STAY', 'EV charging', 'ev_charging', 260, true),
  ('cl_stay_beach', 'STAY', 'Beach access', 'beach_access', 270, true),

  -- Eat facilities
  ('cl_eat_takeaway', 'EAT', 'Takeaway', 'takeaway', 200, true),
  ('cl_eat_delivery', 'EAT', 'Delivery', 'delivery', 210, true),
  ('cl_eat_halal', 'EAT', 'Halal options', 'halal', 220, true),
  ('cl_eat_veg', 'EAT', 'Vegetarian options', 'vegetarian', 230, true),
  ('cl_eat_live', 'EAT', 'Live music', 'live_music', 240, true),
  ('cl_eat_rooftop', 'EAT', 'Rooftop', 'rooftop', 250, true),
  ('cl_eat_bbq', 'EAT', 'BBQ / nyama choma', 'bbq', 260, true),

  -- Move facilities
  ('cl_move_shuttle', 'MOVE', 'Airport shuttle', 'airport_shuttle', 200, true),

  -- Explore facilities
  ('cl_explore_tours', 'EXPLORE', 'Guided tours', 'guided_tours', 200, true),
  ('cl_explore_arcade', 'EXPLORE', 'Arcade / games', 'arcade', 210, true),
  ('cl_explore_beach', 'EXPLORE', 'Beach access', 'beach_access', 220, true),

  -- Meet facilities
  ('cl_meet_conference', 'MEET', 'Conference / meeting rooms', 'conference', 200, true),
  ('cl_meet_events', 'MEET', 'Events space', 'events_space', 210, true),
  ('cl_meet_security', 'MEET', '24h security', 'security', 220, true),
  ('cl_meet_ev', 'MEET', 'EV charging', 'ev_charging', 230, true)
ON CONFLICT ("id") DO NOTHING;
