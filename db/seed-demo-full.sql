-- =============================================================================
-- Safari Hub — full demo data (tourist + provider + admin views)
-- Run AFTER: safari-hub.sql (+ 2026-features.sql if not already included)
--
-- Demo logins:
--   admin@safarihub.ke    / admin123456
--   tourist@safarihub.ke  / tourist123
--   provider@safarihub.ke / provider123
-- =============================================================================

-- Provider user + business
INSERT INTO "User" ("id","name","email","passwordHash","role","createdAt","updatedAt")
VALUES (
  'user_provider',
  'Demo Provider',
  'provider@safarihub.ke',
  '$2b$10$ycIF2UlW8a.GRnuW8hGbfO5YXVdsKjfvc7WScSCagiwxIMxR5yLpO',
  'PROVIDER',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = 'PROVIDER',
  "name" = EXCLUDED."name";

INSERT INTO "Provider" (
  "id","name","slug","description","phone","email","isApproved","commissionRate",
  "kycType","kycStatus","createdAt","updatedAt"
) VALUES (
  'prov_demo_explore',
  'Rift Valley Experiences',
  'rift-valley-experiences',
  'Lodges, dining, transfers, tours and venues across Kenya.',
  '254712000001',
  'provider@safarihub.ke',
  true,
  10,
  'COMPANY',
  'APPROVED',
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "isApproved" = true,
  "email" = EXCLUDED."email",
  "kycStatus" = 'APPROVED',
  "description" = EXCLUDED."description";

INSERT INTO "ProviderMember" ("id","providerId","userId","role")
VALUES ('pm_demo_owner', 'prov_demo_explore', 'user_provider', 'PROVIDER')
ON CONFLICT ("providerId","userId") DO NOTHING;

-- Pending provider (for admin approvals queue)
INSERT INTO "Provider" (
  "id","name","slug","description","phone","email","isApproved","commissionRate",
  "kycType","kycStatus","createdAt","updatedAt"
) VALUES (
  'prov_pending_coast',
  'Coastal Breeze Lodges',
  'coastal-breeze-lodges',
  'Awaiting approval — Mombasa boutique stays.',
  '254722000099',
  'pending@coastal.demo',
  false,
  10,
  'INDIVIDUAL',
  'PENDING',
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE
  cid TEXT;
  tid TEXT;
  cid2 TEXT;
  tid2 TEXT;
BEGIN
  SELECT "id" INTO cid FROM "County" WHERE "slug" = 'nairobi' LIMIT 1;
  IF cid IS NULL THEN
    SELECT "id" INTO cid FROM "County" WHERE "isLive" = true LIMIT 1;
  END IF;
  SELECT "id" INTO tid FROM "Town" WHERE "countyId" = cid LIMIT 1;

  SELECT "id" INTO cid2 FROM "County" WHERE "slug" = 'mombasa' LIMIT 1;
  IF cid2 IS NULL THEN cid2 := cid; END IF;
  SELECT "id" INTO tid2 FROM "Town" WHERE "countyId" = cid2 LIMIT 1;
  IF tid2 IS NULL THEN tid2 := tid; END IF;

  IF cid IS NULL THEN
    RAISE NOTICE 'No county found — skip demo listings';
    RETURN;
  END IF;

  -- STAY
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities","phone","website",
    "openingHours","allowOvernight","allowDayUse","featured","isPromoted","createdAt","updatedAt"
  ) VALUES (
    'list_demo_stay',
    'prov_demo_explore',
    cid,
    tid,
    'STAY',
    '["STAY"]'::jsonb,
    '["PLACE"]'::jsonb,
    '["Boutique hotel","Lodge"]'::jsonb,
    'PUBLISHED',
    'Savanna View Boutique Lodge',
    'savanna-view-boutique-lodge',
    'Quiet lodge rooms with garden breakfast. Ideal base for Nairobi day trips and Amboseli packages.',
    'Karen, Nairobi',
    '["wifi","parking","breakfast","pool"]'::jsonb,
    '254712000001',
    'https://example.com/lodge',
    'Check-in 14:00 · Check-out 10:00',
    true,
    true,
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PUBLISHED', "isPromoted" = true;

  INSERT INTO "RoomType" (
    "id","listingId","name","description","quantity","basePrice","dayUsePrice","maxGuests","offerKind","amenities","createdAt","updatedAt"
  ) VALUES (
    'offer_demo_stay_deluxe',
    'list_demo_stay',
    'Deluxe garden room',
    'King bed, ensuite, garden view.',
    6,
    12500,
    6500,
    2,
    'ROOM',
    '["wifi","breakfast"]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "Media" ("id","listingId","url","alt","sortOrder","isCover","createdAt")
  VALUES
    ('media_demo_stay_1','list_demo_stay','/hero/kenya-safari.jpg','Lodge at golden hour',0,true,NOW()),
    ('media_demo_stay_2','list_demo_stay','/hero/elephants-savanna.jpg','Nearby wildlife plains',1,false,NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- EAT
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities","phone","menuUrl",
    "openingHours","allowOvernight","allowDayUse","createdAt","updatedAt"
  ) VALUES (
    'list_demo_eat',
    'prov_demo_explore',
    cid,
    tid,
    'EAT',
    '["EAT"]'::jsonb,
    '["PLACE"]'::jsonb,
    '["Restaurant","Rooftop"]'::jsonb,
    'PUBLISHED',
    'Nyama Choma Terrace',
    'nyama-choma-terrace',
    'Wood-fired grilled meats, sundowners and live acoustic sets on weekends.',
    'Westlands, Nairobi',
    '["wifi","parking","live_music","bar"]'::jsonb,
    '254712000001',
    'https://example.com/menu',
    'Tue–Sun 12:00–23:00',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PUBLISHED';

  INSERT INTO "RoomType" (
    "id","listingId","name","description","quantity","basePrice","dayUsePrice","maxGuests","offerKind","amenities","createdAt","updatedAt"
  ) VALUES (
    'offer_demo_eat_table',
    'list_demo_eat',
    'Table for two (set menu)',
    'Shared plates + soft drink. Alcohol extra.',
    20,
    3200,
    3200,
    2,
    'TABLE',
    '[]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "Media" ("id","listingId","url","alt","sortOrder","isCover","createdAt")
  VALUES ('media_demo_eat_1','list_demo_eat','/hero/elephant-close.jpg','Terrace dining atmosphere',0,true,NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- MOVE
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities","phone",
    "allowOvernight","allowDayUse","createdAt","updatedAt"
  ) VALUES (
    'list_demo_move',
    'prov_demo_explore',
    cid,
    tid,
    'MOVE',
    '["MOVE"]'::jsonb,
    '["PLACE"]'::jsonb,
    '["Airport transfer","Car hire"]'::jsonb,
    'PUBLISHED',
    'JKIA Private Airport Transfer',
    'jkia-private-airport-transfer',
    'Meet-and-greet at JKIA with private SUV. Fixed price to Nairobi CBD / Westlands / Karen.',
    'Jomo Kenyatta International Airport',
    '["airport_shuttle","parking"]'::jsonb,
    '254712000001',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PUBLISHED';

  INSERT INTO "RoomType" (
    "id","listingId","name","description","quantity","basePrice","dayUsePrice","maxGuests","offerKind","amenities","createdAt","updatedAt"
  ) VALUES (
    'offer_demo_move_suv',
    'list_demo_move',
    'Private SUV (1–4 guests)',
    'One-way transfer. Waiting time included.',
    8,
    4500,
    4500,
    4,
    'TRANSFER',
    '[]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "Media" ("id","listingId","url","alt","sortOrder","isCover","createdAt")
  VALUES ('media_demo_move_1','list_demo_move','/hero/kenya-safari.jpg','Safari vehicle transfer',0,true,NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- EXPLORE (tour)
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities","phone","website",
    "openingHours","allowOvernight","allowDayUse","createdAt","updatedAt"
  ) VALUES (
    'list_demo_tour',
    'prov_demo_explore',
    cid,
    tid,
    'EXPLORE',
    '["EXPLORE","MOVE"]'::jsonb,
    '["EXPERIENCE"]'::jsonb,
    '["Tour guide","Day tour"]'::jsonb,
    'PUBLISHED',
    'Nairobi City Highlights Day Tour',
    'nairobi-city-highlights-day-tour',
    'Guided half-day tour of Nairobi highlights with hotel pickup. Perfect for first-time visitors.',
    'Pickup within Nairobi CBD',
    '["guided_tours","parking","wifi"]'::jsonb,
    '254712000001',
    'https://example.com/tours',
    'Daily 08:00–17:00',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PUBLISHED';

  INSERT INTO "RoomType" (
    "id","listingId","name","description","quantity","basePrice","dayUsePrice","maxGuests","offerKind","amenities","createdAt","updatedAt"
  ) VALUES (
    'offer_demo_tour',
    'list_demo_tour',
    'Adult day tour seat',
    'Includes guide and transport. Park fees extra where applicable.',
    20,
    4500,
    4500,
    1,
    'ACTIVITY',
    '[]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "Media" ("id","listingId","url","alt","sortOrder","isCover","createdAt")
  VALUES ('media_demo_tour_1','list_demo_tour','/hero/elephants-savanna.jpg','City and wildlife day tour',0,true,NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- MEET (event listing)
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities","phone",
    "openingHours","allowOvernight","allowDayUse","createdAt","updatedAt"
  ) VALUES (
    'list_demo_event',
    'prov_demo_explore',
    cid,
    tid,
    'MEET',
    '["MEET","EXPLORE"]'::jsonb,
    '["EVENT"]'::jsonb,
    '["Festival / concert","Workshop / class"]'::jsonb,
    'PUBLISHED',
    'Sunset Rooftop Jazz Night',
    'sunset-rooftop-jazz-night',
    'Pay to attend — live jazz under the Nairobi skyline. Limited seats.',
    'Westlands rooftop venue',
    '["live_music","bar","parking"]'::jsonb,
    '254712000001',
    'Gates 18:00',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PUBLISHED';

  INSERT INTO "RoomType" (
    "id","listingId","name","description","quantity","basePrice","dayUsePrice","maxGuests","offerKind","amenities","createdAt","updatedAt"
  ) VALUES (
    'offer_demo_ticket',
    'list_demo_event',
    'General admission ticket',
    'One entry. Soft drinks available to purchase.',
    80,
    1500,
    1500,
    1,
    'TICKET',
    '[]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "Media" ("id","listingId","url","alt","sortOrder","isCover","createdAt")
  VALUES ('media_demo_event_1','list_demo_event','/hero/elephant-herd.jpg','Evening gathering vibe',0,true,NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- PACKAGE listing
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities","phone","website",
    "allowOvernight","allowDayUse","createdAt","updatedAt"
  ) VALUES (
    'list_demo_package',
    'prov_demo_explore',
    cid,
    tid,
    'EXPLORE',
    '["EXPLORE","STAY","MOVE"]'::jsonb,
    '["PACKAGE"]'::jsonb,
    '["Travel agent","Safari package","Multi-day package"]'::jsonb,
    'PUBLISHED',
    '3-Day Amboseli Safari Package',
    '3-day-amboseli-safari-package',
    'Travel-agent style package: transport, lodge nights, and game drives. Departs Nairobi.',
    'Departs Nairobi',
    '["guided_tours","airport_shuttle"]'::jsonb,
    '254712000001',
    'https://example.com/packages',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PUBLISHED';

  INSERT INTO "RoomType" (
    "id","listingId","name","description","quantity","basePrice","dayUsePrice","maxGuests","offerKind","amenities","createdAt","updatedAt"
  ) VALUES (
    'offer_demo_package',
    'list_demo_package',
    'Per person sharing',
    '3 days / 2 nights. Single supplement on request.',
    12,
    45000,
    45000,
    2,
    'PACKAGE',
    '[]'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "Media" ("id","listingId","url","alt","sortOrder","isCover","createdAt")
  VALUES ('media_demo_pkg_1','list_demo_package','/hero/elephants-savanna.jpg','Amboseli elephants',0,true,NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- Draft listing for provider + admin pending approvals
  INSERT INTO "Listing" (
    "id","providerId","countyId","townId","category","categories","listingKinds","venueTypes",
    "status","title","slug","description","address","amenities",
    "allowOvernight","allowDayUse","createdAt","updatedAt"
  ) VALUES (
    'list_demo_draft',
    'prov_demo_explore',
    COALESCE(cid2, cid),
    COALESCE(tid2, tid),
    'STAY',
    '["STAY"]'::jsonb,
    '["PLACE"]'::jsonb,
    '["Guesthouse"]'::jsonb,
    'PENDING_REVIEW',
    'Diani Palm Guesthouse (pending)',
    'diani-palm-guesthouse-pending',
    'New coast guesthouse awaiting admin approval.',
    'Diani Beach',
    '["wifi","parking"]'::jsonb,
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT ("providerId","slug") DO UPDATE SET "status" = 'PENDING_REVIEW';

END $$;

-- Bookings for tourist (and provider bookings page)
INSERT INTO "Booking" (
  "id","reference","listingId","roomTypeId","travelerId",
  "checkIn","checkOut","guests","roomsBooked","status","paymentMethod","paymentStatus",
  "totalAmount","subtotalAmount","vatRate","vatAmount","notes","createdAt","updatedAt"
) VALUES
(
  'book_demo_confirmed',
  'SH-DEMO-001',
  'list_demo_stay',
  'offer_demo_stay_deluxe',
  'user_tourist',
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '16 days',
  2,
  1,
  'CONFIRMED',
  'MPESA',
  'PAID',
  29000,
  25000,
  16,
  4000,
  'Honeymoon trip — late check-in ok',
  NOW() - INTERVAL '3 days',
  NOW()
),
(
  'book_demo_pending',
  'SH-DEMO-002',
  'list_demo_tour',
  'offer_demo_tour',
  'user_tourist',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days',
  1,
  1,
  'PENDING',
  'CASH_ON_ARRIVAL',
  'PENDING',
  4500,
  4500,
  0,
  0,
  'Morning pickup from CBD',
  NOW() - INTERVAL '1 day',
  NOW()
),
(
  'book_demo_completed',
  'SH-DEMO-003',
  'list_demo_eat',
  'offer_demo_eat_table',
  'user_tourist',
  NOW() - INTERVAL '20 days',
  NOW() - INTERVAL '20 days',
  2,
  1,
  'COMPLETED',
  'CARD',
  'PAID',
  3200,
  3200,
  0,
  0,
  NULL,
  NOW() - INTERVAL '25 days',
  NOW() - INTERVAL '19 days'
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Payment" ("id","bookingId","method","status","amount","providerRef","createdAt","updatedAt")
VALUES
  ('pay_demo_1','book_demo_confirmed','MPESA','PAID',29000,'MPESA-DEMO-001',NOW()-INTERVAL '3 days',NOW()),
  ('pay_demo_3','book_demo_completed','CARD','PAID',3200,'CARD-DEMO-003',NOW()-INTERVAL '20 days',NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Payout" ("id","providerId","bookingId","amount","commission","status","createdAt","updatedAt")
VALUES
  ('payout_demo_1','prov_demo_explore','book_demo_confirmed',26100,2900,'PENDING',NOW(),NOW()),
  ('payout_demo_3','prov_demo_explore','book_demo_completed',2880,320,'PAID',NOW()-INTERVAL '18 days',NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Review" (
  "id","listingId","bookingId","travelerId","rating","comment","reply","createdAt","updatedAt"
) VALUES (
  'rev_demo_1',
  'list_demo_eat',
  'book_demo_completed',
  'user_tourist',
  5,
  'Incredible nyama choma and sunset views. Will be back.',
  'Asante sana — see you next time!',
  NOW() - INTERVAL '18 days',
  NOW() - INTERVAL '17 days'
)
ON CONFLICT ("id") DO NOTHING;

-- Favorites
INSERT INTO "Favorite" ("id","userId","listingId","createdAt") VALUES
  ('fav_demo_1','user_tourist','list_demo_stay',NOW()),
  ('fav_demo_2','user_tourist','list_demo_package',NOW()),
  ('fav_demo_3','user_tourist','list_demo_tour',NOW())
ON CONFLICT ("userId","listingId") DO NOTHING;

-- Messages
INSERT INTO "Conversation" (
  "id","listingId","providerId","travelerId","subject","status",
  "lastMessageAt","unreadForProvider","unreadForTraveler","createdAt","updatedAt"
) VALUES (
  'conv_demo_1',
  'list_demo_stay',
  'prov_demo_explore',
  'user_tourist',
  'Late check-in for SH-DEMO-001',
  'OPEN',
  NOW() - INTERVAL '2 hours',
  1,
  0,
  NOW() - INTERVAL '1 day',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Message" ("id","conversationId","senderId","senderRole","body","createdAt") VALUES
  ('msg_demo_1','conv_demo_1','user_tourist','TOURIST','Hi — we land at 21:30. Can we check in late?',NOW()-INTERVAL '1 day'),
  ('msg_demo_2','conv_demo_1','user_provider','PROVIDER','Absolutely. Front desk is open until midnight.',NOW()-INTERVAL '20 hours'),
  ('msg_demo_3','conv_demo_1','user_tourist','TOURIST','Perfect, thank you!',NOW()-INTERVAL '2 hours')
ON CONFLICT ("id") DO NOTHING;

-- Loyalty
INSERT INTO "LoyaltyAccount" ("id","userId","points","updatedAt")
VALUES ('loyalty_demo_tourist','user_tourist',1250,NOW())
ON CONFLICT ("userId") DO UPDATE SET "points" = 1250;

INSERT INTO "LoyaltyLedger" ("id","accountId","points","reason","createdAt") VALUES
  ('ll_demo_1','loyalty_demo_tourist',1000,'Completed booking SH-DEMO-003',NOW()-INTERVAL '19 days'),
  ('ll_demo_2','loyalty_demo_tourist',250,'Confirmed booking SH-DEMO-001',NOW()-INTERVAL '3 days')
ON CONFLICT ("id") DO NOTHING;

-- Inquiry
INSERT INTO "Inquiry" (
  "id","listingId","providerId","travelerId","name","email","phone","message","status","createdAt","updatedAt"
) VALUES (
  'inq_demo_1',
  'list_demo_package',
  'prov_demo_explore',
  'user_tourist',
  'Demo Tourist',
  'tourist@safarihub.ke',
  '254700000001',
  'Do you have August departures for Amboseli?',
  'NEW',
  NOW() - INTERVAL '5 hours',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Notifications
INSERT INTO "Notification" ("id","userId","type","title","body","href","read","createdAt") VALUES
  ('notif_t1','user_tourist','BOOKING','Booking confirmed','Savanna View Boutique Lodge is confirmed.','/account',false,NOW()-INTERVAL '3 days'),
  ('notif_t2','user_tourist','MESSAGE','Provider replied','Rift Valley Experiences replied to your message.','/account/messages',false,NOW()-INTERVAL '20 hours'),
  ('notif_p1','user_provider','BOOKING','New booking','SH-DEMO-002 is awaiting confirmation.','/provider/bookings',false,NOW()-INTERVAL '1 day'),
  ('notif_p2','user_provider','INQUIRY','New inquiry','Question about Amboseli package.','/provider/inquiries',false,NOW()-INTERVAL '5 hours'),
  ('notif_a1','user_admin','APPROVAL','Listing pending review','Diani Palm Guesthouse awaits approval.','/admin/approvals',false,NOW()-INTERVAL '6 hours')
ON CONFLICT ("id") DO NOTHING;

-- Platform events + packages pages
INSERT INTO "Event" (
  "id","countyId","title","slug","description","startsAt","endsAt","venue","imageUrl","isPublished","createdAt","updatedAt"
)
SELECT
  'event_demo_1',
  c."id",
  'Nairobi Safari Marathon Weekend',
  'nairobi-safari-marathon-weekend',
  'Race weekend — book stays early. Expo and family fun runs included.',
  NOW() + INTERVAL '45 days',
  NOW() + INTERVAL '47 days',
  'Uhuru Gardens',
  '/hero/kenya-safari.jpg',
  true,
  NOW(),
  NOW()
FROM "County" c WHERE c."slug" = 'nairobi'
ON CONFLICT ("slug") DO UPDATE SET "isPublished" = true;

INSERT INTO "TravelPackage" (
  "id","title","slug","description","price","days","imageUrl","isPublished","createdAt","updatedAt"
) VALUES (
  'tpkg_demo_1',
  'Maasai Mara Fly-in Escape',
  'maasai-mara-fly-in-escape',
  '2 nights tented camp, game drives, return flights from Nairobi.',
  78000,
  3,
  '/hero/elephants-savanna.jpg',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET "isPublished" = true, "price" = 78000;

INSERT INTO "PackageItem" ("id","packageId","label","details") VALUES
  ('tpkg_item_1','tpkg_demo_1','Flights','Wilson ↔ Mara return'),
  ('tpkg_item_2','tpkg_demo_1','Accommodation','Shared tent, full board'),
  ('tpkg_item_3','tpkg_demo_1','Game drives','Morning and evening with guide')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AuditLog" ("id","actorId","actorName","actorEmail","action","entityType","entityId","summary","metadata","createdAt")
VALUES
  ('audit_demo_1','user_admin','Safari Hub Admin','admin@safarihub.ke','APPROVE_PROVIDER','Provider','prov_demo_explore','Approved Rift Valley Experiences','{"note":"KYC cleared"}'::jsonb,NOW()-INTERVAL '10 days'),
  ('audit_demo_2','user_admin','Safari Hub Admin','admin@safarihub.ke','PUBLISH_LISTING','Listing','list_demo_stay','Published Savanna View Boutique Lodge','{}'::jsonb,NOW()-INTERVAL '8 days')
ON CONFLICT ("id") DO NOTHING;
