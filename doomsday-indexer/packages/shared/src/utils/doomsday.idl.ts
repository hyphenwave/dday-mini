/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/doomsday.json`.
 */
export type Doomsday = {
  address: '7KfFEX13WEqj8LjQm2p3causqkGRp27ejHinsHRNWrdK'
  metadata: {
    name: 'doomsday'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'Created with Anchor'
  }
  instructions: [
    {
      name: 'addAuthorizedUpdater'
      discriminator: [16, 116, 173, 76, 1, 216, 209, 153]
      accounts: [
        {
          name: 'updater'
          signer: true
        },
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'newUpdater'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'buyOnCurve'
      discriminator: [6, 20, 84, 191, 116, 79, 21, 147]
      accounts: [
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'globalAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'mint'
          writable: true
        },
        {
          name: 'buyerAta'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'payer'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'mint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'tokenVault'
          writable: true
        },
        {
          name: 'solTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'protocolTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [80, 82, 79, 84, 79, 95, 84, 82, 69, 65, 83, 85, 82, 89]
              },
            ]
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'auth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'minTokensOut'
          type: 'u64'
        },
        {
          name: 'solIn'
          type: 'u64'
        },
      ]
    },
    {
      name: 'endRound'
      discriminator: [54, 47, 1, 200, 250, 6, 144, 63]
      accounts: [
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'winnerCountryId'
          type: 'u16'
        },
        {
          name: 'nextEndUnix'
          type: 'i64'
        },
      ]
    },
    {
      name: 'executeSecondPrize'
      discriminator: [104, 30, 236, 181, 21, 145, 216, 249]
      accounts: [
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'globalAccount'
          docs: ['CHECK']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'winnerCountry'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'winner_country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'winnerMint'
          writable: true
        },
        {
          name: 'winnerTokenVault'
          writable: true
        },
        {
          name: 'winnerSolTreasury'
          docs: ['CHECK']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'account'
                path: 'winner_country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'auth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
      ]
      args: [
        {
          name: 'raydiumIxData'
          type: {
            option: 'bytes'
          }
        },
      ]
    },
    {
      name: 'freezeCurve'
      discriminator: [32, 111, 233, 162, 73, 192, 120, 77]
      accounts: [
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'getCountryPrice'
      discriminator: [149, 174, 146, 254, 141, 254, 114, 221]
      accounts: [
        {
          name: 'country'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'getCountryPriceView'
      discriminator: [158, 248, 205, 30, 187, 72, 34, 224]
      accounts: [
        {
          name: 'country'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'initCountry'
      discriminator: [201, 133, 157, 82, 200, 54, 95, 169]
      accounts: [
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'authority'
          writable: true
          signer: true
          relations: ['global']
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'arg'
                path: 'id'
              },
            ]
          }
        },
        {
          name: 'mint'
          writable: true
        },
        {
          name: 'tokenVault'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'burnMintAuth'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'mint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'solTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'arg'
                path: 'id'
              },
            ]
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'id'
          type: 'u16'
        },
        {
          name: 'virtualSol'
          type: 'u128'
        },
        {
          name: 'virtualToken'
          type: 'u128'
        },
      ]
    },
    {
      name: 'initGlobal'
      discriminator: [44, 238, 77, 253, 76, 182, 192, 162]
      accounts: [
        {
          name: 'authority'
          writable: true
          signer: true
        },
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'protocolTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [80, 82, 79, 84, 79, 95, 84, 82, 69, 65, 83, 85, 82, 89]
              },
            ]
          }
        },
        {
          name: 'auth'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'roundEndsAtUnix'
          type: 'i64'
        },
      ]
    },
    {
      name: 'launchNuke'
      discriminator: [135, 137, 106, 28, 172, 54, 93, 153]
      accounts: [
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'winnerCountry'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'winner_country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'president'
          signer: true
        },
        {
          name: 'targetCountry'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'target_country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'targetSolTreasury'
          docs: ['CHECK']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'account'
                path: 'target_country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'winnerMint'
          writable: true
        },
        {
          name: 'winnerTokenVault'
          writable: true
        },
        {
          name: 'winnerSolTreasury'
          docs: ['CHECK']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'account'
                path: 'winner_country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'randomCountrySolTreasury'
          docs: ['CHECK (donation leg)']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'arg'
                path: 'randomCountryId'
              },
            ]
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'auth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
      ]
      args: [
        {
          name: 'targetCountryId'
          type: 'u16'
        },
        {
          name: 'randomCountryId'
          type: 'u16'
        },
        {
          name: 'raydiumIxData'
          type: {
            option: 'bytes'
          }
        },
      ]
    },
    {
      name: 'removeAuthorizedUpdater'
      discriminator: [213, 178, 15, 133, 138, 146, 141, 115]
      accounts: [
        {
          name: 'updater'
          signer: true
        },
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'remove'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'seedRaydiumPool'
      docs: [
        'Transfers seeding liquidity into program-owned custody (PDA) and records Raydium pool.',
        'SOL moves from country treasury to the program signer PDA; tokens move from program vault',
        'to a PDA-owned token account. This ensures the program owns liquidity and can later',
        'add/remove liquidity via CPI. Finally, it records Raydium pool addresses and flips mode → Amm.',
      ]
      discriminator: [203, 255, 125, 168, 139, 36, 111, 187]
      accounts: [
        {
          name: 'authority'
          writable: true
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'mint'
          writable: true
        },
        {
          name: 'tokenVault'
          writable: true
        },
        {
          name: 'solTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'liquidityTokenAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'burnMintAuth'
              },
              {
                kind: 'account'
                path: 'tokenProgram'
              },
              {
                kind: 'account'
                path: 'mint'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'auth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'associatedTokenProgram'
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'raydiumProgram'
          type: 'pubkey'
        },
        {
          name: 'poolState'
          type: 'pubkey'
        },
        {
          name: 'raydiumVaultA'
          type: 'pubkey'
        },
        {
          name: 'raydiumVaultB'
          type: 'pubkey'
        },
        {
          name: 'raydiumIxData'
          type: 'bytes'
        },
      ]
    },
    {
      name: 'sellOnCurve'
      discriminator: [158, 242, 158, 47, 48, 215, 214, 209]
      accounts: [
        {
          name: 'seller'
          writable: true
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'globalAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'mint'
          writable: true
        },
        {
          name: 'sellerAta'
          writable: true
        },
        {
          name: 'tokenVault'
          writable: true
        },
        {
          name: 'solTreasury'
          docs: ['CHECK']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [84, 82, 69, 65, 83, 85, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
        {
          name: 'protocolTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [80, 82, 79, 84, 79, 95, 84, 82, 69, 65, 83, 85, 82, 89]
              },
            ]
          }
        },
        {
          name: 'burnMintAuth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'auth'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [65, 85, 84, 72]
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'minSolOut'
          type: 'u64'
        },
        {
          name: 'tokensIn'
          type: 'u64'
        },
      ]
    },
    {
      name: 'setCountryPause'
      discriminator: [101, 9, 48, 190, 60, 199, 158, 245]
      accounts: [
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'paused'
          type: 'bool'
        },
      ]
    },
    {
      name: 'setCountryQuoteOffchain'
      discriminator: [122, 137, 54, 206, 241, 23, 244, 67]
      accounts: [
        {
          name: 'updater'
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'priceQ64'
          type: 'u128'
        },
        {
          name: 'marketcap'
          type: 'u128'
        },
        {
          name: 'source'
          type: {
            defined: {
              name: 'quoteSource'
            }
          }
        },
        {
          name: 'observedAt'
          type: 'i64'
        },
      ]
    },
    {
      name: 'setPause'
      discriminator: [63, 32, 154, 2, 56, 103, 79, 45]
      accounts: [
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'global'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'paused'
          type: 'bool'
        },
      ]
    },
    {
      name: 'setPresidentOffchain'
      discriminator: [153, 3, 239, 188, 22, 92, 220, 0]
      accounts: [
        {
          name: 'updater'
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'country'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [67, 79, 85, 78, 84, 82, 89]
              },
              {
                kind: 'account'
                path: 'country.id'
                account: 'country'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'newPresident'
          type: 'pubkey'
        },
        {
          name: 'topHolderFreeBalance'
          type: 'u64'
        },
      ]
    },
    {
      name: 'withdrawProtocolFees'
      discriminator: [11, 68, 165, 98, 18, 208, 134, 73]
      accounts: [
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'global'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [71, 76, 79, 66, 65, 76]
              },
            ]
          }
        },
        {
          name: 'protocolTreasury'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [80, 82, 79, 84, 79, 95, 84, 82, 69, 65, 83, 85, 82, 89]
              },
            ]
          }
        },
        {
          name: 'recipient'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'lamports'
          type: 'u64'
        },
      ]
    },
  ]
  accounts: [
    {
      name: 'authorities'
      discriminator: [149, 69, 232, 208, 223, 63, 191, 3]
    },
    {
      name: 'country'
      discriminator: [164, 237, 10, 6, 41, 234, 56, 158]
    },
    {
      name: 'global'
      discriminator: [167, 232, 232, 177, 200, 108, 114, 127]
    },
  ]
  events: [
    {
      name: 'boughtOnCurve'
      discriminator: [1, 98, 255, 43, 61, 71, 58, 82]
    },
    {
      name: 'countryPrice'
      discriminator: [131, 108, 214, 9, 100, 149, 69, 83]
    },
    {
      name: 'curveFrozen'
      discriminator: [179, 163, 227, 174, 28, 144, 67, 186]
    },
    {
      name: 'migratedToAmm'
      discriminator: [243, 124, 139, 232, 19, 190, 136, 113]
    },
    {
      name: 'nukeLaunched'
      discriminator: [200, 27, 78, 126, 106, 65, 61, 220]
    },
    {
      name: 'presidentUpdated'
      discriminator: [96, 128, 142, 69, 215, 194, 117, 244]
    },
    {
      name: 'roundEnded'
      discriminator: [70, 113, 6, 162, 176, 78, 201, 19]
    },
    {
      name: 'secondPrizeExecuted'
      discriminator: [239, 49, 59, 15, 150, 157, 196, 31]
    },
    {
      name: 'soldOnCurve'
      discriminator: [147, 231, 167, 243, 1, 150, 130, 46]
    },
  ]
  errors: [
    {
      code: 6000
      name: 'paused'
      msg: 'paused'
    },
    {
      code: 6001
      name: 'roundNotEnded'
      msg: 'Round not ended yet'
    },
    {
      code: 6002
      name: 'nukeAlreadyUsed'
      msg: 'Already nuked this round'
    },
    {
      code: 6003
      name: 'notWinnerPresident'
      msg: 'Only winner president may launch nuke'
    },
    {
      code: 6004
      name: 'countryNuked'
      msg: 'Country nuked'
    },
    {
      code: 6005
      name: 'invalidAmount'
      msg: 'Invalid amount'
    },
    {
      code: 6006
      name: 'slippage'
      msg: 'Slippage exceeded'
    },
    {
      code: 6007
      name: 'unauthorized'
      msg: 'unauthorized'
    },
    {
      code: 6008
      name: 'wrongMode'
      msg: 'Wrong market mode'
    },
    {
      code: 6009
      name: 'curveNotFrozen'
      msg: 'Curve not frozen'
    },
    {
      code: 6010
      name: 'insufficientLiquidity'
      msg: 'Insufficient liquidity'
    },
  ]
  types: [
    {
      name: 'authorities'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'burnMintAuthBump'
            type: 'u8'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'boughtOnCurve'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'round'
            type: 'u32'
          },
          {
            name: 'country'
            type: 'u16'
          },
          {
            name: 'buyer'
            type: 'pubkey'
          },
          {
            name: 'solIn'
            type: 'u64'
          },
          {
            name: 'tokensOut'
            type: 'u64'
          },
          {
            name: 'priceBp'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'country'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'id'
            type: 'u16'
          },
          {
            name: 'status'
            type: {
              defined: {
                name: 'countryStatus'
              }
            }
          },
          {
            name: 'paused'
            type: 'bool'
          },
          {
            name: 'mode'
            type: {
              defined: {
                name: 'marketMode'
              }
            }
          },
          {
            name: 'curveFrozen'
            type: 'bool'
          },
          {
            name: 'mint'
            type: 'pubkey'
          },
          {
            name: 'tokenVault'
            type: 'pubkey'
          },
          {
            name: 'solTreasury'
            type: 'pubkey'
          },
          {
            name: 'virtualSol'
            type: 'u128'
          },
          {
            name: 'virtualToken'
            type: 'u128'
          },
          {
            name: 'supplyMinted'
            type: 'u64'
          },
          {
            name: 'supplyBurned'
            type: 'u64'
          },
          {
            name: 'curveFeeBp'
            type: 'u64'
          },
          {
            name: 'stepTokens'
            type: 'u64'
          },
          {
            name: 'stepBasePriceLamports'
            type: 'u64'
          },
          {
            name: 'curveSlopePerTokenSqE6'
            type: 'u64'
          },
          {
            name: 'currentStepIndex'
            type: 'u64'
          },
          {
            name: 'soldInCurrentStep'
            type: 'u64'
          },
          {
            name: 'president'
            type: 'pubkey'
          },
          {
            name: 'topHolderCached'
            type: 'u64'
          },
          {
            name: 'migrateThresholdUsdE6'
            type: 'u64'
          },
          {
            name: 'raydiumPoolState'
            type: 'pubkey'
          },
          {
            name: 'raydiumVaultA'
            type: 'pubkey'
          },
          {
            name: 'raydiumVaultB'
            type: 'pubkey'
          },
          {
            name: 'raydiumProgram'
            type: 'pubkey'
          },
          {
            name: 'migratedAtTs'
            type: 'i64'
          },
          {
            name: 'quotePriceQ64'
            type: 'u128'
          },
          {
            name: 'quoteMarketcap'
            type: 'u128'
          },
          {
            name: 'quoteSource'
            type: {
              defined: {
                name: 'quoteSource'
              }
            }
          },
          {
            name: 'quoteObservedAt'
            type: 'i64'
          },
          {
            name: 'bump'
            type: 'u8'
          },
        ]
      }
    },
    {
      name: 'countryPrice'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'country'
            type: 'u16'
          },
          {
            name: 'mode'
            type: {
              defined: {
                name: 'marketMode'
              }
            }
          },
          {
            name: 'priceLamportsPerToken'
            type: 'u64'
          },
          {
            name: 'stepIndex'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'countryStatus'
      type: {
        kind: 'enum'
        variants: [
          {
            name: 'active'
          },
          {
            name: 'nuked'
          },
        ]
      }
    },
    {
      name: 'curveFrozen'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'country'
            type: 'u16'
          },
        ]
      }
    },
    {
      name: 'global'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'authority'
            type: 'pubkey'
          },
          {
            name: 'roundIndex'
            type: 'u32'
          },
          {
            name: 'roundEndsAtUnix'
            type: 'i64'
          },
          {
            name: 'winnerCountryId'
            type: 'u16'
          },
          {
            name: 'nukeConsumedForRound'
            type: 'bool'
          },
          {
            name: 'prizePotLamports'
            type: 'u64'
          },
          {
            name: 'countriesLive'
            type: 'u16'
          },
          {
            name: 'paused'
            type: 'bool'
          },
          {
            name: 'bump'
            type: 'u8'
          },
          {
            name: 'secondPrizeClaimedRound'
            type: 'u32'
          },
          {
            name: 'authorizedUpdaters'
            type: {
              vec: 'pubkey'
            }
          },
        ]
      }
    },
    {
      name: 'marketMode'
      type: {
        kind: 'enum'
        variants: [
          {
            name: 'curve'
          },
          {
            name: 'amm'
          },
        ]
      }
    },
    {
      name: 'migratedToAmm'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'country'
            type: 'u16'
          },
          {
            name: 'poolState'
            type: 'pubkey'
          },
          {
            name: 'at'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'nukeLaunched'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'roundIndex'
            type: 'u32'
          },
          {
            name: 'winnerCountryId'
            type: 'u16'
          },
          {
            name: 'targetCountryId'
            type: 'u16'
          },
          {
            name: 'solRugged'
            type: 'u64'
          },
          {
            name: 'toBuyback'
            type: 'u64'
          },
          {
            name: 'toRandom'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'presidentUpdated'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'country'
            type: 'u16'
          },
          {
            name: 'president'
            type: 'pubkey'
          },
          {
            name: 'topHolder'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'quoteSource'
      type: {
        kind: 'enum'
        variants: [
          {
            name: 'curve'
          },
          {
            name: 'raydium'
          },
          {
            name: 'oracle'
          },
          {
            name: 'unknown'
          },
        ]
      }
    },
    {
      name: 'roundEnded'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'roundIndex'
            type: 'u32'
          },
          {
            name: 'winnerCountryId'
            type: 'u16'
          },
        ]
      }
    },
    {
      name: 'secondPrizeExecuted'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'roundIndex'
            type: 'u32'
          },
          {
            name: 'winnerCountryId'
            type: 'u16'
          },
          {
            name: 'solSpent'
            type: 'u64'
          },
          {
            name: 'tokensBurned'
            type: 'u64'
          },
          {
            name: 'mode'
            type: {
              defined: {
                name: 'marketMode'
              }
            }
          },
        ]
      }
    },
    {
      name: 'soldOnCurve'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'round'
            type: 'u32'
          },
          {
            name: 'country'
            type: 'u16'
          },
          {
            name: 'seller'
            type: 'pubkey'
          },
          {
            name: 'tokensIn'
            type: 'u64'
          },
          {
            name: 'solOut'
            type: 'u64'
          },
          {
            name: 'priceBp'
            type: 'u64'
          },
        ]
      }
    },
  ]
}
