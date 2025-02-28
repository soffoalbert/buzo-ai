/**
 * Economic Data Service
 * 
 * This service provides economic data for South Africa to enhance the AI advisor
 * with local economic context.
 */

// Interface for economic indicators
export interface EconomicIndicators {
  inflationRate: number;
  unemploymentRate: number;
  interestRate: number;
  gdpGrowthRate: number;
  currencyExchangeRate: {
    USD: number;
    EUR: number;
    GBP: number;
  };
  lastUpdated: string;
}

// Interface for provincial economic data
export interface ProvincialEconomicData {
  province: string;
  averageIncome: number;
  unemploymentRate: number;
  costOfLivingIndex: number; // 100 = national average
  majorIndustries: string[];
}

// Current economic indicators for South Africa
// These would ideally be fetched from an API, but for now we'll use static data
// that can be updated periodically
const CURRENT_ECONOMIC_INDICATORS: EconomicIndicators = {
  inflationRate: 5.4, // Annual inflation rate (%)
  unemploymentRate: 32.9, // Unemployment rate (%)
  interestRate: 8.25, // Repo rate (%)
  gdpGrowthRate: 0.6, // Annual GDP growth rate (%)
  currencyExchangeRate: {
    USD: 18.5, // 1 USD to ZAR
    EUR: 20.1, // 1 EUR to ZAR
    GBP: 23.5, // 1 GBP to ZAR
  },
  lastUpdated: '2023-09-15' // Date of last update
};

// Provincial economic data
const PROVINCIAL_ECONOMIC_DATA: ProvincialEconomicData[] = [
  {
    province: 'Gauteng',
    averageIncome: 13500,
    unemploymentRate: 28.2,
    costOfLivingIndex: 110,
    majorIndustries: ['Finance', 'Manufacturing', 'Mining']
  },
  {
    province: 'Western Cape',
    averageIncome: 12800,
    unemploymentRate: 24.1,
    costOfLivingIndex: 115,
    majorIndustries: ['Tourism', 'Agriculture', 'Finance']
  },
  {
    province: 'KwaZulu-Natal',
    averageIncome: 9800,
    unemploymentRate: 33.5,
    costOfLivingIndex: 95,
    majorIndustries: ['Manufacturing', 'Tourism', 'Agriculture']
  },
  {
    province: 'Eastern Cape',
    averageIncome: 8200,
    unemploymentRate: 39.5,
    costOfLivingIndex: 85,
    majorIndustries: ['Automotive', 'Agriculture']
  },
  {
    province: 'Free State',
    averageIncome: 8900,
    unemploymentRate: 35.6,
    costOfLivingIndex: 80,
    majorIndustries: ['Agriculture', 'Mining']
  },
  {
    province: 'Mpumalanga',
    averageIncome: 9100,
    unemploymentRate: 34.7,
    costOfLivingIndex: 85,
    majorIndustries: ['Mining', 'Agriculture', 'Forestry']
  },
  {
    province: 'Limpopo',
    averageIncome: 7800,
    unemploymentRate: 36.9,
    costOfLivingIndex: 75,
    majorIndustries: ['Mining', 'Agriculture', 'Tourism']
  },
  {
    province: 'North West',
    averageIncome: 8500,
    unemploymentRate: 35.7,
    costOfLivingIndex: 80,
    majorIndustries: ['Mining', 'Agriculture']
  },
  {
    province: 'Northern Cape',
    averageIncome: 8300,
    unemploymentRate: 28.7,
    costOfLivingIndex: 75,
    majorIndustries: ['Mining', 'Agriculture']
  }
];

/**
 * Get current economic indicators for South Africa
 * @returns Economic indicators
 */
export const getEconomicIndicators = (): EconomicIndicators => {
  return CURRENT_ECONOMIC_INDICATORS;
};

/**
 * Get economic data for a specific province
 * @param provinceName Name of the province
 * @returns Provincial economic data or undefined if not found
 */
export const getProvincialEconomicData = (provinceName?: string): ProvincialEconomicData | undefined => {
  if (!provinceName) return undefined;
  
  return PROVINCIAL_ECONOMIC_DATA.find(
    data => data.province.toLowerCase() === provinceName.toLowerCase()
  );
};

/**
 * Get economic context for AI advisor based on user's location
 * @param province User's province
 * @returns Economic context string
 */
export const getEconomicContext = (province?: string): string => {
  const indicators = getEconomicIndicators();
  const provincialData = province ? getProvincialEconomicData(province) : undefined;
  
  let context = `Current South African economic indicators: inflation rate ${indicators.inflationRate}%, ` +
    `unemployment rate ${indicators.unemploymentRate}%, interest rate ${indicators.interestRate}%, ` +
    `GDP growth rate ${indicators.gdpGrowthRate}%.`;
  
  if (provincialData) {
    context += ` In ${provincialData.province}, the average income is R${provincialData.averageIncome}, ` +
      `unemployment rate is ${provincialData.unemploymentRate}%, ` +
      `and the cost of living is ${provincialData.costOfLivingIndex > 100 ? 'higher' : 'lower'} ` +
      `than the national average. Major industries include ${provincialData.majorIndustries.join(', ')}.`;
  }
  
  return context;
};

/**
 * Get financial tips based on current economic conditions
 * @returns Array of financial tips
 */
export const getEconomicTips = (): string[] => {
  const indicators = getEconomicIndicators();
  const tips: string[] = [];
  
  // Tips based on inflation
  if (indicators.inflationRate > 5) {
    tips.push('With high inflation, consider investing in inflation-protected assets like property or inflation-linked bonds.');
    tips.push('Review your budget regularly as prices are rising faster than usual.');
  }
  
  // Tips based on interest rates
  if (indicators.interestRate > 7) {
    tips.push('With high interest rates, prioritize paying off high-interest debt like credit cards and personal loans.');
    tips.push('Consider fixed-rate loans over variable-rate loans to protect against further rate increases.');
  } else {
    tips.push('Current interest rates make it a good time to consider refinancing existing loans.');
  }
  
  // Tips based on unemployment
  if (indicators.unemploymentRate > 30) {
    tips.push('In this challenging job market, build an emergency fund covering at least 6 months of expenses.');
    tips.push('Consider developing multiple income streams or side hustles for financial security.');
  }
  
  // Tips based on currency exchange
  if (indicators.currencyExchangeRate.USD > 18) {
    tips.push('The weak rand makes imported goods more expensive. Consider local alternatives where possible.');
    tips.push('If you have foreign currency investments, now might be a good time to repatriate some funds.');
  }
  
  return tips;
};

export default {
  getEconomicIndicators,
  getProvincialEconomicData,
  getEconomicContext,
  getEconomicTips
}; 