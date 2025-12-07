"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nft_badge_service_1 = require("../src/blockchain/nft_badge_service");
test('mintBadgeNFT returns a token id string', async () => {
    const tokenId = await (0, nft_badge_service_1.mintBadgeNFT)('course', {
        userId: 'user123',
        title: 'Completed Solidity 101',
    });
    expect(typeof tokenId).toBe('string');
});
