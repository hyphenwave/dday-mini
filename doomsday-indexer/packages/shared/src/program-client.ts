import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { logger } from './logger'
import { getDoomsdayIdl } from './idl'
import type { Doomsday } from './utils/doomsday.idl'

// Program ID from the Anchor.toml
export const DOOMSDAY_PROGRAM_ID = new PublicKey(
  'CS5ZMcpfdSS7WTgTQp7xYeVN9af3UoAdrZyMgKr3s8Bt'
)

// Constants from the program
export const MAX_COUNTRIES = 211
export const BASIS_POINTS = 10_000
export const GLOBAL_TAX_BP = 50
export const CURVE_FEE_BP_DEFAULT = 100
export const NUKE_RUG_BP = 10_000
export const TOKEN_DECIMALS = 9
export const MIGRATE_THRESHOLD_USD_E6_DEFAULT = 80_000_000

// Seeds for PDAs
export const SEEDS = {
  GLOBAL: Buffer.from('GLOBAL'),
  COUNTRY: Buffer.from('COUNTRY'),
  TREASURY: Buffer.from('TREASURY'),
  AUTH: Buffer.from('AUTH'),
}

export enum CountryStatus {
  Active = 'Active',
  Nuked = 'Nuked',
}

export enum MarketMode {
  Curve = 'Curve',
  Amm = 'Amm',
}

export enum QuoteSource {
  Curve = 'Curve',
  Raydium = 'Raydium',
  Oracle = 'Oracle',
  Unknown = 'Unknown',
}

export interface GlobalAccount {
  authority: PublicKey
  roundIndex: number
  roundEndsAtUnix: anchor.BN
  winnerCountryId: number
  nukeConsumedForRound: boolean
  prizePotLamports: anchor.BN
  countriesLive: number
  paused: boolean
  bump: number
}

export interface CountryAccount {
  id: number
  status: CountryStatus
  paused: boolean
  mode: MarketMode
  curveFrozen: boolean
  mint: PublicKey
  tokenVault: PublicKey
  solTreasury: PublicKey
  virtualSol: anchor.BN
  virtualToken: anchor.BN
  supplyMinted: anchor.BN
  supplyBurned: anchor.BN
  curveFeeBp: anchor.BN
  stepTokens: anchor.BN
  stepBasePriceLamports: anchor.BN
  stepPriceIncrementLamports: anchor.BN
  currentStepIndex: anchor.BN
  soldInCurrentStep: anchor.BN
  president: PublicKey
  topHolderCached: anchor.BN
  migrateThresholdUsdE6: anchor.BN
  raydiumPoolState: PublicKey
  raydiumVaultA: PublicKey
  raydiumVaultB: PublicKey
  raydiumProgram: PublicKey
  migratedAtTs: anchor.BN
  quotePriceQ64: anchor.BN
  quoteMarketcap: anchor.BN
  quoteSource: QuoteSource
  quoteObservedAt: anchor.BN
  bump: number
}

// Wallet adapter for Keypair
class KeypairWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey
  }

  async signTransaction<
    T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction,
  >(tx: T): Promise<T> {
    if ('version' in tx) {
      tx.sign([this.payer])
    } else {
      tx.sign(this.payer)
    }
    return tx
  }

  async signAllTransactions<
    T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction,
  >(txs: T[]): Promise<T[]> {
    return txs.map((tx) => {
      if ('version' in tx) {
        tx.sign([this.payer])
      } else {
        tx.sign(this.payer)
      }
      return tx
    })
  }
}

export class DoomsdayClient {
  private program: Program<Doomsday>
  private provider: AnchorProvider

  constructor(connection: Connection, wallet: Keypair) {
    // Create wallet adapter
    const walletAdapter = new KeypairWallet(wallet)

    // Create provider
    this.provider = new AnchorProvider(connection, walletAdapter, {
      commitment: 'confirmed',
    })

    // Initialize typed program (Doomsday)
    this.program = new Program<Doomsday>(
      getDoomsdayIdl() as unknown as Doomsday,
      this.provider
    )
  }

  /**
   * Get the Global PDA
   */
  getGlobalPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([SEEDS.GLOBAL], DOOMSDAY_PROGRAM_ID)
  }

  /**
   * Get a Country PDA by ID
   */
  getCountryPDA(countryId: number): [PublicKey, number] {
    const idBytes = Buffer.allocUnsafe(2)
    idBytes.writeUInt16LE(countryId, 0)

    return PublicKey.findProgramAddressSync(
      [SEEDS.COUNTRY, idBytes],
      DOOMSDAY_PROGRAM_ID
    )
  }

  /**
   * Get a Treasury PDA by country ID
   */
  getTreasuryPDA(countryId: number): [PublicKey, number] {
    const idBytes = Buffer.allocUnsafe(2)
    idBytes.writeUInt16LE(countryId, 0)

    return PublicKey.findProgramAddressSync(
      [SEEDS.TREASURY, idBytes],
      DOOMSDAY_PROGRAM_ID
    )
  }

  /**
   * Get the Authority PDA
   */
  getAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([SEEDS.AUTH], DOOMSDAY_PROGRAM_ID)
  }

  /**
   * Fetch Global account
   */
  async fetchGlobal(): Promise<GlobalAccount | null> {
    try {
      const [globalPDA] = this.getGlobalPDA()
      const account = await (this.program.account as any).global.fetch(
        globalPDA
      )
      return account as GlobalAccount
    } catch (error) {
      logger.error('Failed to fetch global account:', error)
      return null
    }
  }

  /**
   * Fetch Country account
   */
  async fetchCountry(countryId: number): Promise<CountryAccount | null> {
    try {
      const [countryPDA] = this.getCountryPDA(countryId)
      const account = await (this.program.account as any).country.fetch(
        countryPDA
      )
      return account as CountryAccount
    } catch (error) {
      logger.error(`Failed to fetch country ${countryId}:`, error)
      return null
    }
  }

  /**
   * Fetch all Country accounts
   */
  async fetchAllCountries(): Promise<CountryAccount[]> {
    try {
      const accounts = await (this.program.account as any).country.all()
      return accounts.map((acc: any) => acc.account as CountryAccount)
    } catch (error) {
      logger.error('Failed to fetch all countries:', error)
      return []
    }
  }

  /**
   * Set president for a country (off-chain update)
   */
  async setPresidentOffchain(
    countryId: number,
    president: PublicKey,
    topHolderAmount: anchor.BN
  ) {
    try {
      const [countryPDA] = this.getCountryPDA(countryId)

      const tx = await this.program.methods
        .setPresidentOffchain(president, topHolderAmount)
        .accountsPartial({
          country: countryPDA,
        })
        .accounts({
          updater: this.provider.wallet.publicKey,
        })
        .rpc()

      logger.info(`President updated for country ${countryId}: ${tx}`)
      return tx
    } catch (error) {
      logger.error(`Failed to set president for country ${countryId}:`, error)
      throw error
    }
  }

  /**
   * Update quote for a country
   */
  async updateQuote(
    countryId: number,
    priceQ64: anchor.BN,
    marketcap: anchor.BN,
    source: QuoteSource,
    observedAtUnix?: number
  ) {
    try {
      const [countryPDA] = this.getCountryPDA(countryId)

      const observedAt = new anchor.BN(
        observedAtUnix ?? Math.floor(Date.now() / 1000)
      )

      const tx = await this.program.methods
        .setCountryQuoteOffchain(priceQ64, marketcap, source, observedAt)
        .accountsPartial({
          country: countryPDA,
        })
        .accounts({
          updater: this.provider.wallet.publicKey,
        })
        .rpc()

      logger.info(`Quote updated for country ${countryId}: ${tx}`)
      return tx
    } catch (error) {
      logger.error(`Failed to update quote for country ${countryId}:`, error)
      throw error
    }
  }

  /**
   * End the current round
   */
  async endRound(winnerCountryId: number, nextRoundEndsAt: anchor.BN) {
    try {
      const [globalPDA] = this.getGlobalPDA()

      const tx = await this.program.methods
        .endRound(winnerCountryId, nextRoundEndsAt)
        .accountsPartial({
          global: globalPDA,
        })
        .accounts({
          authority: this.provider.wallet.publicKey,
        })
        .rpc()

      logger.info(`Round ended with winner ${winnerCountryId}: ${tx}`)
      return tx
    } catch (error) {
      logger.error('Failed to end round:', error)
      throw error
    }
  }

  /**
   * Freeze curve for a country (prepare for migration)
   */
  async freezeCurve(countryId: number) {
    try {
      const [countryPDA] = this.getCountryPDA(countryId)

      const tx = await this.program.methods
        .freezeCurve()
        .accountsPartial({
          country: countryPDA,
        })
        .accounts({
          authority: this.provider.wallet.publicKey,
        })
        .rpc()

      logger.info(`Curve frozen for country ${countryId}: ${tx}`)
      return tx
    } catch (error) {
      logger.error(`Failed to freeze curve for country ${countryId}:`, error)
      throw error
    }
  }

  /**
   * Calculate current price on bonding curve
   */
  calculateCurvePrice(country: CountryAccount): number {
    const stepPrice = country.stepBasePriceLamports.add(
      country.currentStepIndex.mul(country.stepPriceIncrementLamports)
    )

    return stepPrice.toNumber() / Math.pow(10, 9) // Convert lamports to SOL
  }

  /**
   * Calculate market cap
   */
  calculateMarketCap(country: CountryAccount, priceInSol: number): number {
    const circulatingSupply = country.supplyMinted.sub(country.supplyBurned)
    const supplyInTokens =
      circulatingSupply.toNumber() / Math.pow(10, TOKEN_DECIMALS)

    return supplyInTokens * priceInSol
  }

  /**
   * Get program instance for direct access
   */
  getProgram(): Program<Doomsday> {
    return this.program
  }

  /**
   * Get provider for direct access
   */
  getProvider(): AnchorProvider {
    return this.provider
  }
}
