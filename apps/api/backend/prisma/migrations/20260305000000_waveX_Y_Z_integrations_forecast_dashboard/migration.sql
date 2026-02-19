-- Wave X, Y, Z: Integrations, Forecast, Dashboard
-- Adds expiration forecast fields to VerificationArtifact

ALTER TABLE "VerificationArtifact" ADD COLUMN "daysUntilExpiration" INTEGER;
ALTER TABLE "VerificationArtifact" ADD COLUMN "forecastRiskLevel" TEXT;

-- Wave Y: Index for forecast risk level queries
CREATE INDEX "VerificationArtifact_forecastRiskLevel_idx" ON "VerificationArtifact"("forecastRiskLevel");
