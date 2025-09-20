'use client';

import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { SensorData, PredictionResponse, WeatherData, WeatherImpact } from '@/app/type';

// Helper function to parse optimal range and compare with current value
function parseOptimalRange(optimalString: string): { min: number; max: number } | null {
  // Handle different formats like "18-25°C", "40-70%", "6.0-7.0", "10000-25000 lux", "100-200 ppm"
  const match = optimalString.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (match) {
    return {
      min: parseFloat(match[1]),
      max: parseFloat(match[2])
    };
  }
  return null;
}

// Helper function to determine status (low, optimal, high)
function getConditionStatus(currentValue: number, optimalRange: { min: number; max: number } | null): 'low' | 'optimal' | 'high' {
  if (!optimalRange) return 'optimal';
  
  if (currentValue < optimalRange.min) return 'low';
  if (currentValue > optimalRange.max) return 'high';
  return 'optimal';
}

// Helper function to get color class based on status
function getStatusColor(status: 'low' | 'optimal' | 'high'): string {
  switch (status) {
    case 'low': return 'text-yellow-400 bg-yellow-900';
    case 'optimal': return 'text-green-400 bg-green-900';
    case 'high': return 'text-red-400 bg-red-900';
    default: return 'text-gray-400 bg-gray-700';
  }
}

interface InputFieldProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  unit: string;
  type?: string;
}

const InputField = ({ label, name, value, onChange, placeholder, unit, type = "number" }: InputFieldProps) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300">
            {label}
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
            <input
                type={type}
                name={name}
                id={name}
                value={value}
                onChange={onChange}
                className="block w-full pr-12 sm:text-sm rounded-md bg-white border-black text-black focus:ring-green-500 focus:border-green-500"
                placeholder={placeholder}
                required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-400 sm:text-sm">{unit}</span>
            </div>
        </div>
    </div>
);

export default function HomePage() {
  const [formData, setFormData] = useState<Partial<SensorData>>({
    soilMoisture: 45,
    ph: 6.8,
    lightIntensity: 18000,
    Nitrogen: 150,
    Phosphorus: 60,
    Potassium: 200,
    plantType: 'Tomato Plant'
  });
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'connected' | 'fallback' | 'error'>('idle');
  const [locationStatus, setLocationStatus] = useState('Fetching location...');
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'plantType' ? value : Number(value) }));
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        setLocationStatus(`Location detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}. Weather data will be fetched during analysis.`);
      }, (error) => {
        console.error("Geolocation Error:", error);
        setLocationStatus('Location access denied. Weather data will not be available.');
      });
    } else {
      setLocationStatus('Geolocation is not supported by this browser. Weather data will not be available.');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPrediction(null);
    setApiStatus('loading');

    try {
      const requestData = {
        ...formData,
        ...(userLocation && { latitude: userLocation.latitude, longitude: userLocation.longitude })
      };
      
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Something went wrong');
      }

      const data: PredictionResponse = await response.json();
      setPrediction(data);
      
      // Check if we're using fallback data
      if (data.problems && data.problems[0] && data.problems[0].includes('Unable to get AI analysis')) {
        setApiStatus('fallback');
      } else {
        setApiStatus('connected');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setApiStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen font-sans">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-green-600">Plantologica</h1>
            <p className="mt-2 text-lg text-gray-600">Get AI-powered analysis of your soil and plant conditions.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-4 text-sm text-gray-500">
            <p>{locationStatus}</p>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Soil Moisture" name="soilMoisture" value={formData.soilMoisture || ''} onChange={handleInputChange} placeholder="e.g., 45" unit="%" />
            <InputField label="Soil pH" name="ph" value={formData.ph || ''} onChange={handleInputChange} placeholder="e.g., 6.8" unit="pH" />
            <InputField label="Light Intensity" name="lightIntensity" value={formData.lightIntensity || ''} onChange={handleInputChange} placeholder="e.g., 18000" unit="lux" />
            <InputField label="Nitrogen" name="Nitrogen" value={formData.Nitrogen || ''} onChange={handleInputChange} placeholder="e.g., 150" unit="ppm" />
            <InputField label="Phosphorus" name="Phosphorus" value={formData.Phosphorus || ''} onChange={handleInputChange} placeholder="e.g., 60" unit="ppm" />
            <InputField label="Potassium" name="Potassium" value={formData.Potassium || ''} onChange={handleInputChange} placeholder="e.g., 200" unit="ppm" />
            <InputField label="Plant Type (Optional)" name="plantType" value={formData.plantType || ''} onChange={handleInputChange} placeholder="e.g., Tomato" unit="" type="text" />
            
            <div className="md:col-span-2 mt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-800 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-300"
              >
                {isLoading ? 'Analyzing...' : 'Get Prediction'}
              </button>
            </div>
          </form>
        </div>

        {/* API Status Indicators */}
        {apiStatus === 'fallback' && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
            <strong className="font-bold">Note: </strong>
            <span className="block sm:inline">Using standard agricultural guidelines as AI service is currently unavailable.</span>
          </div>
        )}

        {apiStatus === 'error' && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">Could not connect to analysis service.</span>
          </div>
        )}

        {error && (
            <div className="mt-8 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {prediction && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-green-600 mb-4">Analysis Result</h2>
            
            {/* Weather Data Display */}
            {prediction.weatherData && (
              <div className="mb-6 bg-gray-100 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-600 mb-3">Current Weather Conditions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">Temperature</p>
                    <p className="font-bold text-gray-900">{prediction.weatherData.temperature}°C</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">Humidity</p>
                    <p className="font-bold text-gray-900">{prediction.weatherData.humidity}%</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">Wind Speed</p>
                    <p className="font-bold text-gray-900">{prediction.weatherData.windSpeed} m/s</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">Pressure</p>
                    <p className="font-bold text-gray-900">{prediction.weatherData.pressure} hPa</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-center">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">Weather</p>
                    <p className="font-bold text-gray-900 capitalize">{prediction.weatherData.description}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">Visibility</p>
                    <p className="font-bold text-gray-900">{prediction.weatherData.visibility} km</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600">UV Index</p>
                    <p className="font-bold text-gray-900">
                      {prediction.weatherData.uvIndex !== null && prediction.weatherData.uvIndex !== undefined 
                        ? prediction.weatherData.uvIndex 
                        : 'Not Available'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm text-gray-500">{prediction.weatherData.location}</p>
                </div>
              </div>
            )}

            {/* Weather Impact Analysis */}
            {prediction.weatherImpact && (
              <div className="mb-6 bg-gray-100 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-orange-600 mb-3">Weather Impact Analysis</h3>
                <div className="flex items-center mb-3">
                  <span className="text-sm text-gray-600 mr-2">Risk Level:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    prediction.weatherImpact.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                    prediction.weatherImpact.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {prediction.weatherImpact.riskLevel.toUpperCase()}
                  </span>
                </div>
                
                {prediction.weatherImpact.weatherAlerts.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-red-600 mb-2">Weather Alerts:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {prediction.weatherImpact.weatherAlerts.map((alert, i) => (
                        <li key={i} className="text-red-700 text-sm">{alert}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {prediction.weatherImpact.issues.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-yellow-600 mb-2">Weather Issues:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {prediction.weatherImpact.issues.map((issue, i) => (
                        <li key={i} className="text-yellow-700 text-sm">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {prediction.weatherImpact.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-600 mb-2">Weather Recommendations:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {prediction.weatherImpact.recommendations.map((rec, i) => (
                        <li key={i} className="text-green-700 text-sm">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Overall Assessment</h3>
                <p className="text-gray-600 mt-1">{prediction.assessment}</p>
            </div>

            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1 mt-1 text-gray-600">
                    {prediction.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
            </div>

            {prediction.preventativeCare && prediction.preventativeCare.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Preventative Care</h3>
                <ul className="list-disc list-inside space-y-1 mt-1 text-gray-600">
                  {prediction.preventativeCare.map((care, i) => <li key={i}>{care}</li>)}
                </ul>
              </div>
            )}

             <div>
                <h3 className="text-lg font-semibold text-gray-900">Current vs Optimal Conditions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {Object.entries(prediction.optimalConditions).map(([key, value]) => {
                      // Get current value based on the key
                      let currentValue: number | null = null;
                      let unit = '';
                      
                      switch (key.toLowerCase()) {
                        case 'temperature':
                          currentValue = prediction.weatherData?.temperature || null;
                          unit = '°C';
                          break;
                        case 'humidity':
                          currentValue = prediction.weatherData?.humidity || null;
                          unit = '%';
                          break;
                        case 'soilmoisture':
                          currentValue = formData.soilMoisture || null;
                          unit = '%';
                          break;
                        case 'ph':
                          currentValue = formData.ph || null;
                          unit = 'pH';
                          break;
                        case 'lightintensity':
                          currentValue = formData.lightIntensity || null;
                          unit = 'lux';
                          break;
                        case 'nitrogen':
                          currentValue = formData.Nitrogen || null;
                          unit = 'ppm';
                          break;
                        case 'phosphorus':
                          currentValue = formData.Phosphorus || null;
                          unit = 'ppm';
                          break;
                        case 'potassium':
                          currentValue = formData.Potassium || null;
                          unit = 'ppm';
                          break;
                      }

                      const optimalRange = parseOptimalRange(value);
                      const status = currentValue !== null ? getConditionStatus(currentValue, optimalRange) : 'optimal';
                      const statusColor = getStatusColor(status);

                      return (
                        <div key={key} className="bg-gray-100 p-4 rounded-lg">
                          <p className="text-sm capitalize text-gray-600 mb-2">{key.replace(/([A-Z])/g, ' $1')}</p>
                          
                          {/* Current Value */}
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">Current</p>
                            <p className={`font-bold text-lg px-2 py-1 rounded ${statusColor}`}>
                              {currentValue !== null ? `${currentValue}${unit}` : 'N/A'}
                            </p>
                          </div>
                          
                          {/* Optimal Range */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Optimal Range</p>
                            <p className="font-bold text-green-600 text-sm">{value}</p>
                          </div>
                          
                          {/* Status Indicator */}
                          <div className="mt-2 flex items-center justify-center">
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
                              {status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}