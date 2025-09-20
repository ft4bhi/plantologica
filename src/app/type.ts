export interface SensorData {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  ph: number;
  lightIntensity: number;
  Nitrogen: number;
  Phosphorus: number;
  Potassium: number;
  plantType?: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  windSpeed: number;
  pressure: number;
  visibility: number;
  uvIndex?: number;
  location: string;
  timestamp: string;
}

export interface WeatherImpact {
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
  weatherAlerts: string[];
}

export interface PredictionResponse {
  assessment: string;
  problems: string[];
  recommendations: string[];
  optimalConditions: {
    temperature: string;
    humidity: string;
    soilMoisture: string;
    ph: string;
    lightIntensity: string;
    nitrogen: string;
    phosphorus: string;
    potassium: string;
  };
  weatherData?: WeatherData;
  weatherImpact?: WeatherImpact;
  preventativeCare?: string[];
  rawResponse?: string;
  isFallback?: boolean;
}