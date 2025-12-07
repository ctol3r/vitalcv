// Neo4j core schema for VitalCV Knowledge Graph
// Run this in Neo4j Browser or via cypher-shell

// Constraints & indexes
CREATE CONSTRAINT specialty_id IF NOT EXISTS FOR (s:Specialty) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT credential_id IF NOT EXISTS FOR (c:Credential) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT workflow_id IF NOT EXISTS FOR (w:Workflow) REQUIRE w.id IS UNIQUE;
CREATE CONSTRAINT provider_id IF NOT EXISTS FOR (p:Provider) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT license_id IF NOT EXISTS FOR (l:License) REQUIRE l.id IS UNIQUE;
CREATE CONSTRAINT market_id IF NOT EXISTS FOR (m:Market) REQUIRE m.id IS UNIQUE;

// Indexes for common queries
CREATE INDEX specialty_name IF NOT EXISTS FOR (s:Specialty) ON (s.name);
CREATE INDEX credential_type IF NOT EXISTS FOR (c:Credential) ON (c.type);
CREATE INDEX provider_npi IF NOT EXISTS FOR (p:Provider) ON (p.npi);

// Relationship types:
// :REQUIRES (Specialty)-[:REQUIRES]->(Credential)
// :ENABLES  (Credential)-[:ENABLES]->(Procedure {code})
// :EQUIVALENT (License)-[:EQUIVALENT]->(MultiStateCompact)
// :SUPERSEDES (BoardCert)-[:SUPERSEDES]->(MaintenanceReq)
// :CORRELATES (Specialty)-[:CORRELATES {signal:"demand"}]->(Market {geo})
// :HAS_CREDENTIAL (Provider)-[:HAS_CREDENTIAL]->(Credential)
// :PRACTICES (Provider)-[:PRACTICES]->(Specialty)
// :WORKFLOW_ENABLED (Provider)-[:WORKFLOW_ENABLED]->(Workflow)

// Example upsert pattern
// MERGE (s:Specialty {id:$specId}) SET s.name=$specName, s.updatedAt=timestamp()
// MERGE (c:Credential {id:$credId}) SET c.name=$credName
// MERGE (s)-[:REQUIRES]->(c);

