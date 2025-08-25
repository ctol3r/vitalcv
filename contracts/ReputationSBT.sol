// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IERC5484 {
    enum BurnAuth {
        IssuerOnly,
        OwnerOnly,
        Both,
        Neither
    }

    event Issued(address indexed from, address indexed to, uint256 indexed tokenId, BurnAuth burnAuth);

    function burnAuth(uint256 tokenId) external view returns (BurnAuth);
}

contract ReputationSBT is ERC721, IERC5484 {
    uint256 private _tokenIds;
    mapping(uint256 => address) private _issuers;
    mapping(uint256 => BurnAuth) private _burnAuthInfo;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function issue(address to, BurnAuth auth) external returns (uint256) {
        _tokenIds += 1;
        uint256 tokenId = _tokenIds;
        _issuers[tokenId] = msg.sender;
        _burnAuthInfo[tokenId] = auth;
        _safeMint(to, tokenId);
        emit Issued(msg.sender, to, tokenId, auth);
        return tokenId;
    }

    function burnAuth(uint256 tokenId) public view override returns (BurnAuth) {
        require(_exists(tokenId), "Nonexistent token");
        return _burnAuthInfo[tokenId];
    }

    function burn(uint256 tokenId) external {
        BurnAuth auth = burnAuth(tokenId);
        address owner = ownerOf(tokenId);
        address issuer = _issuers[tokenId];

        if (auth == BurnAuth.Neither) {
            revert("Token cannot be burned");
        } else if (auth == BurnAuth.IssuerOnly) {
            require(msg.sender == issuer, "Only issuer can burn");
        } else if (auth == BurnAuth.OwnerOnly) {
            require(msg.sender == owner, "Only owner can burn");
        } else if (auth == BurnAuth.Both) {
            require(msg.sender == owner || msg.sender == issuer, "Not authorized to burn");
        }
        delete _burnAuthInfo[tokenId];
        delete _issuers[tokenId];
        _burn(tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        require(from == address(0) || to == address(0), "SBTs are non-transferable");
    }

    function approve(address, uint256) public pure override {
        revert("Approvals disabled for SBT");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Approvals disabled for SBT");
    }
}
