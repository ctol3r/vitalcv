// badge_controller.ts - exposes API endpoints for NFT badge minting
import { mintBadgeNFT, BadgeType, BadgeDetails } from '../blockchain/nft_badge_service';

// In an actual Express app, these would be request handlers
export async function issueBadge(type: BadgeType, details: BadgeDetails): Promise<string> {
  // Additional validation or database logic would occur here
  return await mintBadgeNFT(type, details);
}
