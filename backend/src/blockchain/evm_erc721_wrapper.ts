import { BigNumberish, Contract, ContractInterface, Signer, providers } from 'ethers';

/**
 * ERC-721 wrapper around the CHAI Soulbound Token contract.
 * This class provides a typed interface for interacting with the
 * deployed ERC-721 contract on any EVM-compatible chain.
 */
export class ChaiSoulboundToken {
  private contract: Contract;

  constructor(
    address: string,
    providerOrSigner: providers.Provider | Signer,
    abi: ContractInterface = ChaiSoulboundToken.DEFAULT_ABI,
  ) {
    this.contract = new Contract(address, abi, providerOrSigner);
  }

  /**
   * Connect the wrapper to a signer so state changing methods can be called.
   */
  connect(signer: Signer): void {
    this.contract = this.contract.connect(signer);
  }

  /**
   * Mint a new soulbound token to the target address.
   * Requires the wrapper to be connected with a signer that has
   * permission to mint new tokens.
   */
  async mintSoulboundToken(to: string, tokenURI: string): Promise<providers.TransactionResponse> {
    if (!('getAddress' in this.contract.signer)) {
      throw new Error('Contract is not connected with a signer');
    }
    return this.contract.mint(to, tokenURI);
  }

  /** Retrieve the token URI for the given token id. */
  async tokenURI(tokenId: BigNumberish): Promise<string> {
    return this.contract.tokenURI(tokenId);
  }

  /** Get the owner of the specified token. */
  async ownerOf(tokenId: BigNumberish): Promise<string> {
    return this.contract.ownerOf(tokenId);
  }

  /** Obtain the token balance for the owner. */
  async balanceOf(owner: string): Promise<BigNumberish> {
    return this.contract.balanceOf(owner);
  }

  /** The default ABI with the minimal ERC-721 methods required. */
  static readonly DEFAULT_ABI: ContractInterface = [
    'function mint(address to, string tokenURI) returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function balanceOf(address owner) view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  ];
}
