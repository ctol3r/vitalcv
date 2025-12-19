export const GRAPH_SCHEMA_CYPHER: string[] = [
  // Constraints (Neo4j 4+/5+)
  'CREATE CONSTRAINT clinician_id IF NOT EXISTS FOR (c:Clinician) REQUIRE c.id IS UNIQUE',
  'CREATE CONSTRAINT institution_id IF NOT EXISTS FOR (i:Institution) REQUIRE i.id IS UNIQUE',
  'CREATE CONSTRAINT credential_id IF NOT EXISTS FOR (c:Credential) REQUIRE c.id IS UNIQUE',
  'CREATE CONSTRAINT specialty_id IF NOT EXISTS FOR (s:Specialty) REQUIRE s.id IS UNIQUE',
  'CREATE CONSTRAINT license_id IF NOT EXISTS FOR (l:License) REQUIRE l.id IS UNIQUE',
  'CREATE CONSTRAINT boardcert_id IF NOT EXISTS FOR (b:BoardCert) REQUIRE b.id IS UNIQUE',
  'CREATE CONSTRAINT location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE',
  'CREATE CONSTRAINT sanction_id IF NOT EXISTS FOR (s:Sanction) REQUIRE s.id IS UNIQUE',

  // Helpful indexes
  'CREATE INDEX clinician_email IF NOT EXISTS FOR (c:Clinician) ON (c.email)',
  'CREATE INDEX credential_type IF NOT EXISTS FOR (c:Credential) ON (c.type)',
  'CREATE INDEX specialty_name IF NOT EXISTS FOR (s:Specialty) ON (s.name)',
];


