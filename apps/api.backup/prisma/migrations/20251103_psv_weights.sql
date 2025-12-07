CREATE TABLE IF NOT EXISTS "PSVWeightConfig"(
  source TEXT PRIMARY KEY,
  weight INT NOT NULL
);

INSERT INTO "PSVWeightConfig"(source, weight) VALUES
  ('license', 30),
  ('board', 20),
  ('dea', 20),
  ('npdb', 15),
  ('oig', 10),
  ('caqh', 3),
  ('pecos', 2)
ON CONFLICT (source) DO NOTHING;

