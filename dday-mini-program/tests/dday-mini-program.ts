import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { DdayMiniProgram } from '../target/types/dday_mini_program'
import { expect } from 'chai'

describe('World PvP Game', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.ddayMiniProgram as Program<DdayMiniProgram>
  const provider = anchor.getProvider()

  let gamePda: anchor.web3.PublicKey
  let gameBump: number

  before(async () => {
    ;[gamePda, gameBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('game')],
      program.programId
    )
  })

  it('Initialize the game', async () => {
    const tx = await program.methods
      .initializeGame()
      .accounts({
        game: gamePda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log('Game initialization signature:', tx)

    const gameAccount = await program.account.game.fetch(gamePda)
    expect(gameAccount.currentRound).to.equal(1)
    expect(gameAccount.totalCountries).to.equal(211)
    expect(gameAccount.activeCountries).to.equal(211)
  })

  it('Create a country', async () => {
    const countryId = 1
    const countryName = 'United States'

    const [countryPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('country'), Buffer.from([countryId])],
      program.programId
    )

    const tx = await program.methods
      .createCountry(countryId, countryName)
      .accounts({
        country: countryPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log('Country creation signature:', tx)

    const countryAccount = await program.account.country.fetch(countryPda)
    expect(countryAccount.id).to.equal(countryId)
    expect(countryAccount.name).to.equal(countryName)
    expect(countryAccount.isActive).to.be.true
  })

  it('Buy country tokens', async () => {
    const countryId = 1
    const [countryPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('country'), Buffer.from([countryId])],
      program.programId
    )

    const [playerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('player'), provider.wallet.publicKey.toBuffer()],
      program.programId
    )

    const amount = 1000 // 1000 tokens

    const tx = await program.methods
      .buyCountryTokens(new anchor.BN(amount))
      .accounts({
        country: countryPda,
        player: playerPda,
        playerAccount: provider.wallet.publicKey,
        game: gamePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log('Token purchase signature:', tx)

    const countryAccount = await program.account.country.fetch(countryPda)
    expect(countryAccount.totalSupply.toNumber()).to.be.greaterThan(0)
  })

  it('Send chat message', async () => {
    const message = 'Hello World PvP!'
    const countryId = 1

    const tx = await program.methods
      .sendChatMessage(message, countryId)
      .accounts({
        chatMessage: anchor.web3.Keypair.generate().publicKey,
        player: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log('Chat message signature:', tx)
  })

  it('Decorate country', async () => {
    const countryId = 1
    const imageUrl = 'https://example.com/flag.png'
    const duration = 86400 // 1 day

    const [decorationPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('decoration'), Buffer.from([countryId])],
      program.programId
    )

    const tx = await program.methods
      .decorateCountry(countryId, imageUrl, new anchor.BN(duration))
      .accounts({
        decoration: decorationPda,
        player: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log('Country decoration signature:', tx)

    const decorationAccount = await program.account.decoration.fetch(
      decorationPda
    )
    expect(decorationAccount.countryId).to.equal(countryId)
    expect(decorationAccount.imageUrl).to.equal(imageUrl)
  })
})
