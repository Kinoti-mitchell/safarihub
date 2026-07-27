-- Kenya locations (safe to re-run)
INSERT INTO "Country" ("id","name","slug","code","isLive","latitude","longitude","createdAt","updatedAt") VALUES
  ('country_kenya', 'Kenya', 'kenya', 'KE', true, -1.2921, 36.8219, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "isLive" = true,
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";

INSERT INTO "County" ("id","countryId","name","slug","isLive","latitude","longitude","createdAt","updatedAt") VALUES
  ('county_mombasa', 'country_kenya', 'Mombasa', 'mombasa', true, -4.0435, 39.6682, NOW(), NOW()),
  ('county_kwale', 'country_kenya', 'Kwale', 'kwale', true, -4.1737, 39.4521, NOW(), NOW()),
  ('county_kilifi', 'country_kenya', 'Kilifi', 'kilifi', true, -3.6305, 39.8499, NOW(), NOW()),
  ('county_tana-river', 'country_kenya', 'Tana River', 'tana-river', true, -1.4826, 40.0339, NOW(), NOW()),
  ('county_lamu', 'country_kenya', 'Lamu', 'lamu', true, -2.2717, 40.902, NOW(), NOW()),
  ('county_taita-taveta', 'country_kenya', 'Taita-Taveta', 'taita-taveta', true, -3.3869, 38.556, NOW(), NOW()),
  ('county_garissa', 'country_kenya', 'Garissa', 'garissa', true, -0.4532, 39.6461, NOW(), NOW()),
  ('county_wajir', 'country_kenya', 'Wajir', 'wajir', true, 1.7471, 40.0573, NOW(), NOW()),
  ('county_mandera', 'country_kenya', 'Mandera', 'mandera', true, 3.9373, 41.8569, NOW(), NOW()),
  ('county_marsabit', 'country_kenya', 'Marsabit', 'marsabit', true, 2.3284, 37.9899, NOW(), NOW()),
  ('county_isiolo', 'country_kenya', 'Isiolo', 'isiolo', true, 0.3556, 37.5833, NOW(), NOW()),
  ('county_meru', 'country_kenya', 'Meru', 'meru', true, 0.0515, 37.6456, NOW(), NOW()),
  ('county_tharaka-nithi', 'country_kenya', 'Tharaka-Nithi', 'tharaka-nithi', true, -0.296, 37.873, NOW(), NOW()),
  ('county_embu', 'country_kenya', 'Embu', 'embu', true, -0.539, 37.458, NOW(), NOW()),
  ('county_kitui', 'country_kenya', 'Kitui', 'kitui', true, -1.367, 38.01, NOW(), NOW()),
  ('county_machakos', 'country_kenya', 'Machakos', 'machakos', true, -1.5177, 37.2634, NOW(), NOW()),
  ('county_makueni', 'country_kenya', 'Makueni', 'makueni', true, -1.8039, 37.6243, NOW(), NOW()),
  ('county_nyandarua', 'country_kenya', 'Nyandarua', 'nyandarua', true, -0.232, 36.495, NOW(), NOW()),
  ('county_nyeri', 'country_kenya', 'Nyeri', 'nyeri', true, -0.4197, 36.9476, NOW(), NOW()),
  ('county_kirinyaga', 'country_kenya', 'Kirinyaga', 'kirinyaga', true, -0.6591, 37.3827, NOW(), NOW()),
  ('county_muranga', 'country_kenya', 'Murang''a', 'muranga', true, -0.783, 37.04, NOW(), NOW()),
  ('county_kiambu', 'country_kenya', 'Kiambu', 'kiambu', true, -1.1714, 36.8356, NOW(), NOW()),
  ('county_turkana', 'country_kenya', 'Turkana', 'turkana', true, 3.3122, 35.5658, NOW(), NOW()),
  ('county_west-pokot', 'country_kenya', 'West Pokot', 'west-pokot', true, 1.6219, 35.3981, NOW(), NOW()),
  ('county_samburu', 'country_kenya', 'Samburu', 'samburu', true, 1.215, 36.954, NOW(), NOW()),
  ('county_trans-nzoia', 'country_kenya', 'Trans Nzoia', 'trans-nzoia', true, 1.0567, 34.95, NOW(), NOW()),
  ('county_uasin-gishu', 'country_kenya', 'Uasin Gishu', 'uasin-gishu', true, 0.5143, 35.2698, NOW(), NOW()),
  ('county_elgeyo-marakwet', 'country_kenya', 'Elgeyo-Marakwet', 'elgeyo-marakwet', true, 0.804, 35.538, NOW(), NOW()),
  ('county_nandi', 'country_kenya', 'Nandi', 'nandi', true, 0.186, 35.12, NOW(), NOW()),
  ('county_baringo', 'country_kenya', 'Baringo', 'baringo', true, 0.4667, 35.9667, NOW(), NOW()),
  ('county_laikipia', 'country_kenya', 'Laikipia', 'laikipia', true, 0.205, 36.787, NOW(), NOW()),
  ('county_nakuru', 'country_kenya', 'Nakuru', 'nakuru', true, -0.3031, 36.08, NOW(), NOW()),
  ('county_narok', 'country_kenya', 'Narok', 'narok', true, -1.078, 35.86, NOW(), NOW()),
  ('county_kajiado', 'country_kenya', 'Kajiado', 'kajiado', true, -1.85, 36.78, NOW(), NOW()),
  ('county_kericho', 'country_kenya', 'Kericho', 'kericho', true, -0.3689, 35.2863, NOW(), NOW()),
  ('county_bomet', 'country_kenya', 'Bomet', 'bomet', true, -0.7813, 35.3416, NOW(), NOW()),
  ('county_kakamega', 'country_kenya', 'Kakamega', 'kakamega', true, 0.2827, 34.7519, NOW(), NOW()),
  ('county_vihiga', 'country_kenya', 'Vihiga', 'vihiga', true, 0.081, 34.722, NOW(), NOW()),
  ('county_bungoma', 'country_kenya', 'Bungoma', 'bungoma', true, 0.5635, 34.5606, NOW(), NOW()),
  ('county_busia', 'country_kenya', 'Busia', 'busia', true, 0.4608, 34.1115, NOW(), NOW()),
  ('county_siaya', 'country_kenya', 'Siaya', 'siaya', true, 0.0607, 34.2882, NOW(), NOW()),
  ('county_kisumu', 'country_kenya', 'Kisumu', 'kisumu', true, -0.0917, 34.768, NOW(), NOW()),
  ('county_homa-bay', 'country_kenya', 'Homa Bay', 'homa-bay', true, -0.5273, 34.4571, NOW(), NOW()),
  ('county_migori', 'country_kenya', 'Migori', 'migori', true, -1.0634, 34.4731, NOW(), NOW()),
  ('county_kisii', 'country_kenya', 'Kisii', 'kisii', true, -0.6817, 34.7667, NOW(), NOW()),
  ('county_nyamira', 'country_kenya', 'Nyamira', 'nyamira', true, -0.5633, 34.9358, NOW(), NOW()),
  ('county_nairobi', 'country_kenya', 'Nairobi', 'nairobi', true, -1.2921, 36.8219, NOW(), NOW())
ON CONFLICT ("countryId", "slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isLive" = true,
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";

INSERT INTO "Town" ("id", "name", "slug", "countyId", "latitude", "longitude")
SELECT
  left('town_' || v.county_slug || '_' || v.town_slug, 64),
  v.town_name,
  v.town_slug,
  c.id,
  v.lat,
  v.lng
FROM (VALUES
  ('mombasa', 'Mombasa', 'mombasa-town', -4.0435, 39.6682),  ('kwale', 'Kwale', 'kwale-town', -4.1737, 39.4521),  ('kilifi', 'Kilifi', 'kilifi-town', -3.6305, 39.8499),  ('tana-river', 'Hola', 'hola', -1.4826, 40.0339),  ('lamu', 'Lamu', 'lamu-town', -2.2717, 40.902),  ('taita-taveta', 'Wundanyi', 'wundanyi', -3.3869, 38.556),  ('garissa', 'Garissa', 'garissa-town', -0.4532, 39.6461),  ('wajir', 'Wajir', 'wajir-town', 1.7471, 40.0573),  ('mandera', 'Mandera', 'mandera-town', 3.9373, 41.8569),  ('marsabit', 'Marsabit', 'marsabit-town', 2.3284, 37.9899),  ('isiolo', 'Isiolo', 'isiolo-town', 0.3556, 37.5833),  ('meru', 'Meru', 'meru-town', 0.0515, 37.6456),  ('tharaka-nithi', 'Kathwana', 'kathwana', -0.296, 37.873),  ('embu', 'Embu', 'embu-town', -0.539, 37.458),  ('kitui', 'Kitui', 'kitui-town', -1.367, 38.01),  ('machakos', 'Machakos', 'machakos-town', -1.5177, 37.2634),  ('makueni', 'Wote', 'wote', -1.8039, 37.6243),  ('nyandarua', 'Ol Kalou', 'ol-kalou', -0.232, 36.495),  ('nyeri', 'Nyeri', 'nyeri-town', -0.4197, 36.9476),  ('kirinyaga', 'Kerugoya', 'kerugoya', -0.6591, 37.3827),  ('muranga', 'Murang''a', 'muranga-town', -0.783, 37.04),  ('kiambu', 'Kiambu', 'kiambu-town', -1.1714, 36.8356),  ('turkana', 'Lodwar', 'lodwar', 3.1191, 35.5973),  ('turkana', 'Kakuma', 'kakuma', 3.7172, 34.8606),  ('turkana', 'Kalokol', 'kalokol', 3.525, 35.85),  ('west-pokot', 'Kapenguria', 'kapenguria', 1.2389, 35.12),  ('samburu', 'Maralal', 'maralal', 1.0968, 36.698),  ('trans-nzoia', 'Kitale', 'kitale', 1.0157, 35.0062),  ('uasin-gishu', 'Eldoret', 'eldoret', 0.5143, 35.2698),  ('elgeyo-marakwet', 'Iten', 'iten', 0.6703, 35.5081),  ('nandi', 'Kapsabet', 'kapsabet', 0.202, 35.105),  ('baringo', 'Kabarnet', 'kabarnet', 0.4919, 35.743),  ('laikipia', 'Nanyuki', 'nanyuki', 0.0105, 37.0735),  ('nakuru', 'Nakuru', 'nakuru-town', -0.3031, 36.08),  ('narok', 'Narok', 'narok-town', -1.078, 35.86),  ('kajiado', 'Kajiado', 'kajiado-town', -1.85, 36.78),  ('kericho', 'Kericho', 'kericho-town', -0.3689, 35.2863),  ('bomet', 'Bomet', 'bomet-town', -0.7813, 35.3416),  ('kakamega', 'Kakamega', 'kakamega-town', 0.2827, 34.7519),  ('vihiga', 'Mbale', 'mbale', 0.081, 34.722),  ('bungoma', 'Bungoma', 'bungoma-town', 0.5635, 34.5606),  ('busia', 'Busia', 'busia-town', 0.4608, 34.1115),  ('siaya', 'Siaya', 'siaya-town', 0.0607, 34.2882),  ('kisumu', 'Kisumu', 'kisumu-town', -0.0917, 34.768),  ('homa-bay', 'Homa Bay', 'homa-bay-town', -0.5273, 34.4571),  ('migori', 'Migori', 'migori-town', -1.0634, 34.4731),  ('kisii', 'Kisii', 'kisii-town', -0.6817, 34.7667),  ('nyamira', 'Nyamira', 'nyamira-town', -0.5633, 34.9358),  ('nairobi', 'Nairobi CBD', 'nairobi-cbd', -1.2864, 36.8172),  ('nairobi', 'Westlands', 'westlands', -1.2673, 36.811),  ('nairobi', 'Eastleigh', 'eastleigh', -1.274, 36.848),  ('nairobi', 'Karen', 'karen', -1.3197, 36.7086)
) AS v(county_slug, town_name, town_slug, lat, lng)
JOIN "County" c
  ON c.slug = v.county_slug
 AND c."countryId" = 'country_kenya'
ON CONFLICT ("countyId", "slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude";
