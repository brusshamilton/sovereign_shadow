import { LucideIcon } from 'lucide-react';

export type ProjectType = 'NUCLEAR' | 'DELIVERY' | 'COVERT' | 'CIVILIAN';

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  cost: number;
  resourceCost: number;
  suspicionImpact: number; // Positive increases suspicion, negative decreases it
  progress: number; // 0 to 100
  isUnlocked: boolean;
  requirements?: string[]; // IDs of other projects
  incomeBonus?: number; // Permanent increase to daily funds
  resourceBonus?: number; // Permanent increase to daily resources
  oneTimeFunds?: number; // Instant funds on completion
  oneTimeResources?: number; // Instant resources on completion
  isRepeatable?: boolean;
  repeatCount?: number;
  progressGain?: number; // Custom progress per day (default 5)
}

export interface NewsItem {
  id: string;
  text: string;
  type: 'NEUTRAL' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  timestamp: number;
  day: number;
}

export interface GameState {
  funds: number;
  resources: number;
  suspicion: number; // 0 to 100
  day: number;
  projects: Record<string, Project>;
  news: NewsItem[];
  isGameOver: boolean;
  winConditionMet: boolean;
  gameOverReason?: string;
  hasSeenIntro: boolean;
  fundsGeneration: number;
  resourceGeneration: number;
  prMultiplier: number;
  researchMultiplier: number;
  passiveSuspicionRate: number;
}

export const INITIAL_FUNDS = 250000; // Reduced
export const INITIAL_RESOURCES = 50; // Reduced
export const INITIAL_FUNDS_GEN = 1500; // Reduced from 2500
export const INITIAL_RESOURCES_GEN = 0.5; // Decreased from 1
export const MAX_SUSPICION = 100;
export const TICK_RATE = 2000; // 2 seconds per day

export const PROJECTS: Record<string, Project> = {
  'uranium_mining': {
    id: 'uranium_mining',
    name: 'Uranium Prospecting',
    description: 'Search for domestic uranium deposits. Increases resource production.',
    type: 'NUCLEAR',
    cost: 50000,
    resourceCost: 60,
    suspicionImpact: 8,
    progress: 0,
    isUnlocked: true,
    resourceBonus: 3,
  },
  'centrifuge_research': {
    id: 'centrifuge_research',
    name: 'Centrifuge Development',
    description: 'Research high-speed centrifuges for enrichment.',
    type: 'NUCLEAR',
    cost: 150000,
    resourceCost: 150,
    suspicionImpact: 15,
    progress: 0,
    isUnlocked: false,
    requirements: ['uranium_mining'],
  },
  'warhead_design': {
    id: 'warhead_design',
    name: 'Warhead Miniaturization',
    description: 'Design a warhead capable of fitting on a missile.',
    type: 'NUCLEAR',
    cost: 500000,
    resourceCost: 200,
    suspicionImpact: 25,
    progress: 0,
    isUnlocked: false,
    requirements: ['centrifuge_research'],
  },
  'rocket_engines': {
    id: 'rocket_engines',
    name: 'High-Thrust Engines',
    description: 'Develop powerful engines for long-range flight.',
    type: 'DELIVERY',
    cost: 100000,
    resourceCost: 100,
    suspicionImpact: 10,
    progress: 0,
    isUnlocked: true,
  },
  'guidance_systems': {
    id: 'guidance_systems',
    name: 'Inertial Guidance',
    description: 'Precision systems to ensure our delivery vehicles reach their targets.',
    type: 'DELIVERY',
    cost: 200000,
    resourceCost: 100,
    suspicionImpact: 12,
    progress: 0,
    isUnlocked: false,
    requirements: ['rocket_engines'],
  },
  'icbm_assembly': {
    id: 'icbm_assembly',
    name: 'ICBM Integration',
    description: 'Combine all systems into a functional Intercontinental Ballistic Missile.',
    type: 'DELIVERY',
    cost: 800000,
    resourceCost: 250,
    suspicionImpact: 35,
    progress: 0,
    isUnlocked: false,
    requirements: ['guidance_systems', 'rocket_engines'],
  },
  'propaganda_campaign': {
    id: 'propaganda_campaign',
    name: 'Peaceful Intentions PR',
    description: 'Launch a global media campaign. Repeatable, but cost increases.',
    type: 'COVERT',
    cost: 40000,
    resourceCost: 5,
    suspicionImpact: -10,
    progress: 0,
    isUnlocked: true,
    isRepeatable: true,
    repeatCount: 0,
  },
  'cyber_defense': {
    id: 'cyber_defense',
    name: 'Information Blackout',
    description: 'Secure our networks to prevent intelligence leaks.',
    type: 'COVERT',
    cost: 120000,
    resourceCost: 30,
    suspicionImpact: -10,
    progress: 0,
    isUnlocked: true,
  },
  'nuclear_power_plant': {
    id: 'nuclear_power_plant',
    name: 'Civilian Nuclear Energy',
    description: 'Build a power plant. Increases daily funding.',
    type: 'CIVILIAN',
    cost: 300000,
    resourceCost: 80,
    suspicionImpact: -15,
    progress: 0,
    isUnlocked: false,
    requirements: ['uranium_mining'],
    incomeBonus: 5000,
  },
  'satellite_program': {
    id: 'satellite_program',
    name: 'Telecommunications Satellites',
    description: 'A civilian space program. Increases daily funding.',
    type: 'CIVILIAN',
    cost: 250000,
    resourceCost: 70,
    suspicionImpact: -12,
    progress: 0,
    isUnlocked: false,
    requirements: ['rocket_engines'],
    incomeBonus: 3000,
  },
  'industrial_expansion': {
    id: 'industrial_expansion',
    name: 'Industrial Expansion',
    description: 'Build new factories to increase resource production.',
    type: 'CIVILIAN',
    cost: 100000,
    resourceCost: 30,
    suspicionImpact: 2,
    progress: 0,
    isUnlocked: true,
    resourceBonus: 5,
    isRepeatable: true,
    repeatCount: 0,
  },
  'tax_reform': {
    id: 'tax_reform',
    name: 'Economic Restructuring',
    description: 'Optimize national economy to increase daily revenue.',
    type: 'CIVILIAN',
    cost: 150000,
    resourceCost: 10,
    suspicionImpact: 1,
    progress: 0,
    isUnlocked: true,
    incomeBonus: 2000,
    isRepeatable: true,
    repeatCount: 0,
  },
  'emergency_procurement': {
    id: 'emergency_procurement',
    name: 'Emergency Procurement',
    description: 'Use national funds to buy industrial resources on the black market. Very inefficient.',
    type: 'CIVILIAN',
    cost: 50000,
    resourceCost: 0,
    suspicionImpact: 2,
    progress: 0,
    isUnlocked: true,
    oneTimeResources: 10,
    isRepeatable: true,
    repeatCount: 0,
    progressGain: 100,
  },
  'resource_liquidation': {
    id: 'resource_liquidation',
    name: 'Resource Liquidation',
    description: 'Sell off strategic industrial reserves for quick cash. Very inefficient.',
    type: 'CIVILIAN',
    cost: 0,
    resourceCost: 20,
    suspicionImpact: 1,
    progress: 0,
    isUnlocked: true,
    oneTimeFunds: 20000,
    isRepeatable: true,
    repeatCount: 0,
    progressGain: 100,
  },
  'global_lobbying': {
    id: 'global_lobbying',
    name: 'Global Lobbying Network',
    description: 'Establish a network of influential lobbyists. Increases the effectiveness of PR campaigns.',
    type: 'COVERT',
    cost: 200000,
    resourceCost: 20,
    suspicionImpact: -5,
    progress: 0,
    isUnlocked: false,
    requirements: ['propaganda_campaign'],
  },
  'automated_research': {
    id: 'automated_research',
    name: 'AI Research Assistants',
    description: 'Deploy advanced algorithms to accelerate project development speed.',
    type: 'CIVILIAN',
    cost: 350000,
    resourceCost: 50,
    suspicionImpact: 5,
    progress: 0,
    isUnlocked: false,
    requirements: ['cyber_defense'],
  },
  'diplomatic_backchannel': {
    id: 'diplomatic_backchannel',
    name: 'Diplomatic Backchannels',
    description: 'Establish secret lines of communication to reduce passive suspicion growth.',
    type: 'COVERT',
    cost: 250000,
    resourceCost: 15,
    suspicionImpact: -10,
    progress: 0,
    isUnlocked: false,
    requirements: ['cyber_defense'],
  },
  'foreign_bribes': {
    id: 'foreign_bribes',
    name: 'Strategic Lobbying Bribes',
    description: 'Funnel massive amounts of cash to key foreign officials to look the other way. Reduces suspicion immediately.',
    type: 'COVERT',
    cost: 150000,
    resourceCost: 0,
    suspicionImpact: -15,
    progress: 0,
    isUnlocked: true,
    isRepeatable: true,
    repeatCount: 0,
    progressGain: 100,
  },
};
