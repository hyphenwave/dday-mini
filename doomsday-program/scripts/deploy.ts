import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Doomsday } from '../target/types/doomsday'

async function main() {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.DdayMiniProgram as Program<Doomsday>
  const provider = anchor.getProvider()

  console.log('🚀 Deploying World PvP Program...')

  // Initialize the game
  const [globalPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('GLOBAL')],
    program.programId
  )

  try {
    const tx = await program.methods
      .initGlobal()
      .accounts({
        global: globalPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    console.log('✅ Game initialized successfully!')
    console.log('Transaction signature:', tx)

    // Create some initial countries
    const countries = [
      { id: 1, name: 'United States' },
      { id: 2, name: 'China' },
      { id: 3, name: 'Germany' },
      { id: 4, name: 'Japan' },
      { id: 5, name: 'United Kingdom' },
    ]

    for (const country of countries) {
      const [countryPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('country'), Buffer.from([country.id])],
        program.programId
      )

      try {
        const tx = await program.methods
          .createCountry(country.id, country.name)
          .accounts({
            country: countryPda,
            authority: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()

        console.log(`✅ Created country: ${country.name}`)
        console.log('Transaction signature:', tx)
      } catch (error) {
        console.log(`⚠️  Country ${country.name} might already exist`)
      }
    }

    console.log('\n🎉 World PvP Program deployed successfully!')
    console.log('Program ID:', program.programId.toString())
    console.log('Game PDA:', gamePda.toString())
  } catch (error) {
    console.error('❌ Deployment failed:', error)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
