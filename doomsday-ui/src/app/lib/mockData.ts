// Mock data for the Doomsday game

export interface Country {
  id: string
  name: string
  flag: string
  marketCap: number
  change24h: number
  president: {
    name: string
    avatar: string
    wallet: string
  }
  population: number
  resources: {
    oil: number
    electric: number
    technology: number
    food: number
    water: number
    economy: number
    gold: number
    transport: number
    defense: number
  }
  nukeCount: number
  status: 'active' | 'under-attack' | 'eliminated'
}

export interface ChatMessage {
  id: string
  author: string
  avatar: string
  role: 'President' | 'Citizen'
  message: string
  timestamp: Date
  country?: string
}

export const mockCountries: Country[] = [
  {
    id: 'brazil',
    name: 'Brazil',
    flag: '🇧🇷',
    marketCap: 2847650,
    change24h: 12.5,
    president: {
      name: 'Silva',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Silva',
      wallet: '0x8C1c...10A47930A',
    },
    population: 300000000,
    resources: {
      oil: 85,
      electric: 72,
      technology: 68,
      food: 92,
      water: 88,
      economy: 75,
      gold: 65,
      transport: 70,
      defense: 58,
    },
    nukeCount: 3,
    status: 'active',
  },
  {
    id: 'usa',
    name: 'United States',
    flag: '🇺🇸',
    marketCap: 3521840,
    change24h: 8.3,
    president: {
      name: 'Washington',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Washington',
      wallet: '0x7A2b...9F3C21B',
    },
    population: 300000000,
    resources: {
      oil: 92,
      electric: 95,
      technology: 98,
      food: 85,
      water: 90,
      economy: 96,
      gold: 88,
      transport: 94,
      defense: 99,
    },
    nukeCount: 12,
    status: 'active',
  },
  {
    id: 'china',
    name: 'China',
    flag: '🇨🇳',
    marketCap: 3128950,
    change24h: -3.2,
    president: {
      name: 'Li Wei',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LiWei',
      wallet: '0x3D4e...8B7A45C',
    },
    population: 300000000,
    resources: {
      oil: 78,
      electric: 88,
      technology: 91,
      food: 82,
      water: 75,
      economy: 89,
      gold: 92,
      transport: 87,
      defense: 85,
    },
    nukeCount: 8,
    status: 'active',
  },
  {
    id: 'russia',
    name: 'Russia',
    flag: '🇷🇺',
    marketCap: 1956320,
    change24h: 15.7,
    president: {
      name: 'Ivanov',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ivanov',
      wallet: '0x9E1f...4C8D92A',
    },
    population: 300000000,
    resources: {
      oil: 95,
      electric: 82,
      technology: 85,
      food: 78,
      water: 88,
      economy: 72,
      gold: 80,
      transport: 75,
      defense: 94,
    },
    nukeCount: 15,
    status: 'active',
  },
  {
    id: 'japan',
    name: 'Japan',
    flag: '🇯🇵',
    marketCap: 1654280,
    change24h: 5.1,
    president: {
      name: 'Tanaka',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tanaka',
      wallet: '0x2B3c...7E9F12D',
    },
    population: 300000000,
    resources: {
      oil: 45,
      electric: 92,
      technology: 96,
      food: 68,
      water: 72,
      economy: 88,
      gold: 75,
      transport: 90,
      defense: 78,
    },
    nukeCount: 2,
    status: 'active',
  },
  {
    id: 'germany',
    name: 'Germany',
    flag: '🇩🇪',
    marketCap: 1823450,
    change24h: -1.8,
    president: {
      name: 'Schmidt',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Schmidt',
      wallet: '0x5F6g...3A1B78E',
    },
    population: 300000000,
    resources: {
      oil: 62,
      electric: 88,
      technology: 94,
      food: 85,
      water: 90,
      economy: 91,
      gold: 82,
      transport: 92,
      defense: 80,
    },
    nukeCount: 1,
    status: 'active',
  },
  {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    marketCap: 1432890,
    change24h: 22.4,
    president: {
      name: 'Patel',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Patel',
      wallet: '0x8H9i...6D4E23F',
    },
    population: 300000000,
    resources: {
      oil: 68,
      electric: 75,
      technology: 82,
      food: 88,
      water: 70,
      economy: 78,
      gold: 85,
      transport: 72,
      defense: 76,
    },
    nukeCount: 4,
    status: 'active',
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    flag: '🇬🇧',
    marketCap: 1287340,
    change24h: -5.6,
    president: {
      name: 'Churchill',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Churchill',
      wallet: '0x4C5d...2F8G91H',
    },
    population: 300000000,
    resources: {
      oil: 72,
      electric: 85,
      technology: 90,
      food: 80,
      water: 88,
      economy: 87,
      gold: 78,
      transport: 88,
      defense: 85,
    },
    nukeCount: 5,
    status: 'active',
  },
  {
    id: 'uk1',
    name: 'United Kingdom1',
    flag: '🇬🇧',
    marketCap: 1287340,
    change24h: -5.6,
    president: {
      name: 'Churchill',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Churchill',
      wallet: '0x4C5d...2F8G91H',
    },
    population: 300000000,
    resources: {
      oil: 72,
      electric: 85,
      technology: 90,
      food: 80,
      water: 88,
      economy: 87,
      gold: 78,
      transport: 88,
      defense: 85,
    },
    nukeCount: 5,
    status: 'active',
  },
  {
    id: 'uk11',
    name: 'United Kingdom 11',
    flag: '🇬🇧',
    marketCap: 1287340,
    change24h: -5.6,
    president: {
      name: 'Churchill',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Churchill',
      wallet: '0x4C5d...2F8G91H',
    },
    population: 300000000,
    resources: {
      oil: 72,
      electric: 85,
      technology: 90,
      food: 80,
      water: 88,
      economy: 87,
      gold: 78,
      transport: 88,
      defense: 85,
    },
    nukeCount: 5,
    status: 'active',
  },
]

export const mockMessages: ChatMessage[] = [
  {
    id: '1',
    author: 'Silva',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Silva',
    role: 'President',
    message: "Brazil is rising! Join us before it's too late! 🚀",
    timestamp: new Date(Date.now() - 120000),
    country: 'Brazil',
  },
  {
    id: '2',
    author: 'CryptoWarrior',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoWarrior',
    role: 'Citizen',
    message: 'Just bought 1000 $BRAZIL tokens!',
    timestamp: new Date(Date.now() - 90000),
  },
  {
    id: '3',
    author: 'Ivanov',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ivanov',
    role: 'President',
    message: 'Mother Russia will prevail. We have the nukes.',
    timestamp: new Date(Date.now() - 60000),
    country: 'Russia',
  },
  {
    id: '4',
    author: 'MoonBoy',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MoonBoy',
    role: 'Citizen',
    message: 'LFG!!! USA to the moon! 🌙',
    timestamp: new Date(Date.now() - 45000),
  },
  {
    id: '5',
    author: 'Li Wei',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LiWei',
    role: 'President',
    message: 'Strategic patience. China plays the long game.',
    timestamp: new Date(Date.now() - 30000),
    country: 'China',
  },
  {
    id: '6',
    author: 'DiamondHands',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DiamondHands',
    role: 'Citizen',
    message: 'Never selling my Japan tokens 💎🙌',
    timestamp: new Date(Date.now() - 15000),
  },
]

export const mockEvents = [
  {
    id: '1',
    type: 'nuke',
    description: 'Russia launched a nuke at Germany',
    timestamp: new Date(Date.now() - 300000),
    severity: 'high',
  },
  {
    id: '2',
    type: 'leadership',
    description: 'New president elected in Brazil: Silva',
    timestamp: new Date(Date.now() - 240000),
    severity: 'medium',
  },
  {
    id: '3',
    type: 'market',
    description: 'India market cap surged 22% in 1 hour',
    timestamp: new Date(Date.now() - 180000),
    severity: 'low',
  },
  {
    id: '4',
    type: 'nuke',
    description: 'USA launched a nuke at China',
    timestamp: new Date(Date.now() - 120000),
    severity: 'high',
  },
]
