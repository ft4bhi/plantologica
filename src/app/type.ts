export interface SensorData {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  ph: number;
  lightIntensity: number;
  plantType?: string;
}

export interface PredictionResponse {
  assessment: string;
  problems: string[]; // Add this property
  recommendations: string[];
  optimalConditions: {
    temperature: string;
    humidity: string;
    soilMoisture: string;
    ph: string;
    lightIntensity: string;
  };
  rawResponse?: string; // Optional field for debugging
  isFallback?: boolean; // Add this to explicitly identify fallback responses
}