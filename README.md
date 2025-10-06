# Doomsday - Solana Implementation

A decentralized multiplayer game where 211 countries compete for the highest market cap on Solana blockchain. The winning country unlocks a nuclear missile to eliminate another country from the game.

## 🌍 Game Overview

Doomsday is a competitive token-based game where:
- **211 countries** compete for market cap dominance
- **30-day rounds** determine the winner
- **Nuclear missiles** eliminate countries permanently
- **Presidents** control their country's destiny
- **Chat system** enables social interaction and strategy

## 🚀 Key Features

### Core Game Mechanics
- **Country Tokens**: Each country has its own ERC20-like token
- **Bonding Curve**: Tokens start on a bonding curve, deploy to Uniswap at $333k market cap
- **President System**: Top token holder becomes president with crown 👑
- **Nuclear Missiles**: Winners can eliminate other countries
- **Round System**: 30-day competitive periods

### Social Features
- **Country-Gated Chat**: Token holders can chat in country-specific channels
- **Global Chat**: Everyone can participate in global discussions
- **Leaderboard**: Real-time ranking of countries by market cap
- **Country Decorations**: Customize countries with images

### Economic Features
- **Global Tax**: 1% tax on all transactions for prize pool
- **Second Prize**: ETH pool for token buybacks and burns
- **Liquidity Rugging**: Nuclear missiles rug target country's liquidity
- **Elimination System**: Countries are permanently removed from the game

## 🏗️ Architecture

### Solana Program (`dday-mini-program`)
- **Anchor Framework**: Rust-based Solana program
- **PDAs**: Program Derived Addresses for game state
- **Accounts**: Game, Country, Player, ChatMessage, Decoration
- **Instructions**: Buy tokens, send messages, launch nukes, etc.

### Frontend (`dday-miniui`)
- **Next.js 15**: React framework with App Router
- **Solana Wallet**: Phantom, Solflare integration
- **Tailwind CSS**: Modern, responsive design
- **Real-time Updates**: Live game state synchronization

## 📁 Project Structure

```
dday-mini/
├── dday-mini-program/          # Solana Anchor program
│   ├── programs/
│   │   └── dday-mini-program/
│   │       └── src/
│   │           └── lib.rs      # Main program logic
│   ├── tests/
│   │   └── dday-mini-program.ts # Test suite
│   └── Anchor.toml            # Anchor configuration
├── dday-miniui/               # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx       # Main game interface
│   │       ├── layout.tsx     # App layout with wallet provider
│   │       └── components/    # React components
│   └── package.json          # Frontend dependencies
└── README.md                 # This file
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Solana CLI 1.17+
- Anchor CLI 0.30+

### Solana Program Setup
```bash
cd dday-mini-program
anchor build
anchor test
```

### Frontend Setup
```bash
cd dday-miniui
npm install
npm run dev
```

## 🎮 How to Play

1. **Connect Wallet**: Use Phantom or Solflare wallet
2. **Choose Country**: Select a country to invest in
3. **Buy Tokens**: Purchase country tokens using SOL
4. **Become President**: Hold the most tokens to become president
5. **Chat & Strategize**: Use country-specific or global chat
6. **Win Round**: Achieve highest market cap in 30 days
7. **Launch Nuke**: Eliminate another country if you win
8. **Survive**: Avoid elimination to reach the final round

## 🔧 Technical Implementation

### Solana Program Features
- **Game State Management**: Tracks rounds, countries, players
- **Token Economics**: Bonding curve pricing, market cap calculation
- **President Election**: Automatic based on token holdings
- **Nuclear System**: Winner can target and eliminate countries
- **Chat System**: On-chain message storage
- **Decoration System**: Country customization with images

### Frontend Features
- **Responsive Design**: Mobile and desktop optimized
- **Real-time Updates**: Live game state synchronization
- **Wallet Integration**: Seamless Solana wallet connection
- **Interactive Map**: Visual country selection and status
- **Chat Interface**: Multi-channel messaging system
- **Leaderboard**: Live ranking updates

## 🎯 Game Rules

### Round System
- **Duration**: 30 days per round
- **Winner**: Country with highest market cap
- **Rewards**: Nuclear missile + ETH prize pool
- **Elimination**: Target country is permanently removed

### President System
- **Election**: Top token holder becomes president
- **Powers**: Controls nuclear missile targeting
- **Crown**: Visual indicator in chat and UI
- **Overthrow**: Can be dethroned by larger holder

### Economic Model
- **Bonding Curve**: Initial token pricing mechanism
- **Uniswap Deployment**: Automatic at $333k market cap
- **Global Tax**: 1% fee on all transactions
- **Prize Pool**: ETH accumulation for winners
- **Liquidity Rugging**: Nuclear missiles drain target liquidity

## 🚀 Deployment

### Solana Program
```bash
anchor deploy --provider.cluster devnet
```

### Frontend
```bash
npm run build
# Deploy to Vercel, Netlify, or your preferred platform
```

## 🔒 Security Considerations

- **Input Validation**: All user inputs are validated
- **Access Control**: Only presidents can launch nukes
- **Economic Safety**: Bonding curve prevents manipulation
- **Image Moderation**: AI-powered NSFW detection
- **Spam Prevention**: Rate limiting on chat messages

## 🎨 Customization

### Adding New Countries
1. Update country list in program
2. Add country flags to frontend
3. Configure initial parameters
4. Deploy updated program

### UI Themes
- Modify Tailwind classes in components
- Update color schemes in globals.css
- Customize country card designs
- Add new visual effects

## 📊 Analytics & Monitoring

- **Game Metrics**: Track country performance
- **User Engagement**: Monitor chat activity
- **Economic Health**: Monitor token economics
- **System Health**: Track program performance

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Create GitHub issues for bugs
- **Discord**: Join our community for help
- **Email**: Contact support for urgent issues

---

**Ready to dominate the world? Connect your wallet and start your journey to global supremacy! 🌍💣👑**
