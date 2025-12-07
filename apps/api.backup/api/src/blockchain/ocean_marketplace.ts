import { Ocean, Config, Account, Asset, Datatoken } from '@oceanprotocol/lib'

// ocean_marketplace.ts - prototype integration with Ocean Protocol for data-token marketplace

export class OceanMarketplace {
  ocean: Ocean

  constructor(config: Config) {
    // Instantiate Ocean Protocol with the provided configuration
    this.ocean = new Ocean(config)
  }

  async createDatatoken(
    name: string,
    symbol: string,
    filesUrl: string,
    price: string,
    publisherAccount: Account
  ): Promise<string> {
    // Creates a datatoken and publishes an asset with the Ocean libraries
    const asset: Asset = {
      main: {
        type: 'dataset',
        name,
        dateCreated: new Date().toISOString(),
        author: publisherAccount.getId(),
        license: 'CC0',
        files: [
          {
            url: filesUrl,
            contentType: 'application/json'
          }
        ]
      }
    }

    const ddo = await this.ocean.assets.create(asset, publisherAccount)
    const datatokenAddress = ddo.dataToken
    // Set a fixed price for the datatoken
    await this.ocean.assets.createAccessServiceAttributes(
      datatokenAddress,
      publisherAccount,
      price
    )

    return datatokenAddress
  }

  async buyDatatoken(datatokenAddress: string, buyerAccount: Account, price: string) {
    // Simple purchase flow for the datatoken
    const dt = new Datatoken(this.ocean.web3, datatokenAddress)
    await dt.buy(buyerAccount.getId(), price)
  }
}
