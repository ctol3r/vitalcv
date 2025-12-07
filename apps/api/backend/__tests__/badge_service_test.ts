import { mintBadgeNFT } from '../src/blockchain/nft_badge_service';

test('mintBadgeNFT returns a token id string', async () => {
  const tokenId = await mintBadgeNFT('course', {
    userId: 'user123',
    title: 'Completed Solidity 101',
  });
  expect(typeof tokenId).toBe('string');
});
