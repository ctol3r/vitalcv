-- Wave C60-C61: Geospatial intelligence schema
-- Add additive spatial read models and boundary assignments without
-- disturbing existing trust-core persistence.

CREATE TYPE "GeocodeStatus" AS ENUM ('PENDING', 'GEOCODED', 'FAILED');
CREATE TYPE "GeocodePrecision" AS ENUM ('ROOFTOP', 'STREET', 'ZIP_CENTROID', 'STATE_CENTROID', 'UNRESOLVED');
CREATE TYPE "ProviderLocationType" AS ENUM ('PRACTICE', 'MAILING', 'TRAINING', 'EMPLOYER');
CREATE TYPE "GeographicBoundaryType" AS ENUM ('HPSA', 'STATE');
CREATE TYPE "BoundaryAssignmentMethod" AS ENUM ('ZIP', 'COUNTY_FIPS', 'POINT_IN_POLYGON', 'HRSA_LOOKUP');

CREATE TABLE "institutions" (
  "id" UUID NOT NULL,
  "vcv_entity_id" UUID,
  "organization_profile_id" UUID,
  "canonical_name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ror_id" TEXT,
  "address_line1" TEXT,
  "address_line2" TEXT,
  "city" TEXT,
  "state_code" TEXT,
  "postal_code" TEXT,
  "country_code" TEXT NOT NULL DEFAULT 'US',
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "geocode_status" "GeocodeStatus" NOT NULL DEFAULT 'PENDING',
  "geocode_precision" "GeocodePrecision" NOT NULL DEFAULT 'UNRESOLVED',
  "geocode_source" TEXT,
  "geocode_attempts" INTEGER NOT NULL DEFAULT 0,
  "last_geocoded_at" TIMESTAMPTZ,
  "last_geocode_error" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_locations" (
  "id" UUID NOT NULL,
  "subject_npi" TEXT NOT NULL,
  "person_profile_id" UUID,
  "claim_record_id" UUID,
  "location_type" "ProviderLocationType" NOT NULL DEFAULT 'PRACTICE',
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "source_id" TEXT NOT NULL,
  "trust_tier" TEXT NOT NULL,
  "confidence_score" DOUBLE PRECISION NOT NULL,
  "address_hash" TEXT NOT NULL,
  "address_line1" TEXT,
  "address_line2" TEXT,
  "city" TEXT,
  "state_code" TEXT,
  "postal_code" TEXT,
  "country_code" TEXT NOT NULL DEFAULT 'US',
  "county_fips" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "geocode_status" "GeocodeStatus" NOT NULL DEFAULT 'PENDING',
  "geocode_precision" "GeocodePrecision" NOT NULL DEFAULT 'UNRESOLVED',
  "geocode_source" TEXT,
  "geocode_attempts" INTEGER NOT NULL DEFAULT 0,
  "last_geocoded_at" TIMESTAMPTZ,
  "last_geocode_error" TEXT,
  "observed_at" TIMESTAMPTZ NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "geographic_boundaries" (
  "id" UUID NOT NULL,
  "boundary_type" "GeographicBoundaryType" NOT NULL,
  "external_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state_code" TEXT,
  "county_fips" TEXT,
  "centroid_lat" DECIMAL(9,6),
  "centroid_lng" DECIMAL(9,6),
  "bbox_min_lat" DECIMAL(9,6),
  "bbox_min_lng" DECIMAL(9,6),
  "bbox_max_lat" DECIMAL(9,6),
  "bbox_max_lng" DECIMAL(9,6),
  "geometry_geojson" JSONB NOT NULL,
  "source_dataset" TEXT NOT NULL,
  "data_version" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "geographic_boundaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_boundary_assignments" (
  "id" UUID NOT NULL,
  "provider_location_id" UUID NOT NULL,
  "boundary_id" UUID NOT NULL,
  "assignment_method" "BoundaryAssignmentMethod" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_boundary_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutions_vcv_entity_id_key" ON "institutions"("vcv_entity_id");
CREATE UNIQUE INDEX "institutions_organization_profile_id_key" ON "institutions"("organization_profile_id");
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");
CREATE UNIQUE INDEX "institutions_ror_id_key" ON "institutions"("ror_id");
CREATE INDEX "institutions_latitude_longitude_idx" ON "institutions"("latitude", "longitude");
CREATE INDEX "institutions_state_code_postal_code_idx" ON "institutions"("state_code", "postal_code");
CREATE INDEX "institutions_canonical_name_idx" ON "institutions"("canonical_name");
CREATE INDEX "institutions_geocode_status_updated_at_idx" ON "institutions"("geocode_status", "updated_at");

CREATE UNIQUE INDEX "provider_locations_claim_record_id_key" ON "provider_locations"("claim_record_id");
CREATE INDEX "provider_locations_subject_npi_is_current_idx" ON "provider_locations"("subject_npi", "is_current");
CREATE INDEX "provider_locations_latitude_longitude_idx" ON "provider_locations"("latitude", "longitude");
CREATE INDEX "provider_locations_state_code_postal_code_idx" ON "provider_locations"("state_code", "postal_code");
CREATE INDEX "provider_locations_geocode_status_updated_at_idx" ON "provider_locations"("geocode_status", "updated_at");
CREATE INDEX "provider_locations_address_hash_idx" ON "provider_locations"("address_hash");

CREATE UNIQUE INDEX "geographic_boundaries_boundary_type_external_id_key" ON "geographic_boundaries"("boundary_type", "external_id");
CREATE INDEX "geographic_boundaries_state_code_idx" ON "geographic_boundaries"("state_code");
CREATE INDEX "geographic_boundaries_boundary_type_state_code_idx" ON "geographic_boundaries"("boundary_type", "state_code");
CREATE INDEX "geographic_boundaries_bbox_min_lat_bbox_max_lat_bbox_min_lng_bbox_max_lng_idx"
  ON "geographic_boundaries"("bbox_min_lat", "bbox_max_lat", "bbox_min_lng", "bbox_max_lng");

CREATE UNIQUE INDEX "provider_boundary_assignments_provider_location_id_boundary_id_key"
  ON "provider_boundary_assignments"("provider_location_id", "boundary_id");
CREATE INDEX "provider_boundary_assignments_boundary_id_idx" ON "provider_boundary_assignments"("boundary_id");
CREATE INDEX "provider_boundary_assignments_assignment_method_confidence_idx"
  ON "provider_boundary_assignments"("assignment_method", "confidence");

ALTER TABLE "institutions"
  ADD CONSTRAINT "institutions_vcv_entity_id_fkey"
  FOREIGN KEY ("vcv_entity_id") REFERENCES "vcv_entities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "institutions"
  ADD CONSTRAINT "institutions_organization_profile_id_fkey"
  FOREIGN KEY ("organization_profile_id") REFERENCES "organization_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "provider_locations"
  ADD CONSTRAINT "provider_locations_person_profile_id_fkey"
  FOREIGN KEY ("person_profile_id") REFERENCES "person_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "provider_locations"
  ADD CONSTRAINT "provider_locations_claim_record_id_fkey"
  FOREIGN KEY ("claim_record_id") REFERENCES "claim_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "provider_boundary_assignments"
  ADD CONSTRAINT "provider_boundary_assignments_provider_location_id_fkey"
  FOREIGN KEY ("provider_location_id") REFERENCES "provider_locations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_boundary_assignments"
  ADD CONSTRAINT "provider_boundary_assignments_boundary_id_fkey"
  FOREIGN KEY ("boundary_id") REFERENCES "geographic_boundaries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
