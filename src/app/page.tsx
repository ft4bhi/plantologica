'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { SensorData, PredictionResponse } from '@/app/type';

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
                className="block w-full pr-12 sm:text-sm rounded-md bg-gray-700 border-gray-600 text-white focus:ring-green-500 focus:border-green-500"
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
    temperature: 22,
    humidity: 65,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'plantType' ? value : Number(value) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPrediction(null);
    setApiStatus('loading');

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-green-400">AgriSmart AI</h1>
            <p className="mt-2 text-lg text-gray-300">Get AI-powered analysis of your soil and plant conditions.</p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Temperature" name="temperature" value={formData.temperature || ''} onChange={handleInputChange} placeholder="e.g., 22" unit="°C" />
            <InputField label="Humidity" name="humidity" value={formData.humidity || ''} onChange={handleInputChange} placeholder="e.g., 65" unit="%" />
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
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-300"
              >
                {isLoading ? 'Analyzing...' : 'Get Prediction'}
              </button>
            </div>
          </form>
        </div>

        {/* API Status Indicators */}
        {apiStatus === 'fallback' && (
          <div className="mt-4 bg-yellow-900 border border-yellow-600 text-yellow-200 px-4 py-3 rounded-lg">
            <strong className="font-bold">Note: </strong>
            <span className="block sm:inline">Using standard agricultural guidelines as AI service is currently unavailable.</span>
          </div>
        )}

        {apiStatus === 'error' && (
          <div className="mt-4 bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">Could not connect to analysis service.</span>
          </div>
        )}

        {error && (
            <div className="mt-8 bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {prediction && (
          <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-green-400 mb-4">Analysis Result</h2>
            
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-300">Overall Assessment</h3>
                <p className="text-gray-400 mt-1">{prediction.assessment}</p>
            </div>

            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-300">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1 mt-1 text-gray-400">
                    {prediction.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
            </div>

             <div>
                <h3 className="text-lg font-semibold text-gray-300">Optimal Conditions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-2 text-center">
                    {Object.entries(prediction.optimalConditions).map(([key, value]) => (
                         <div key={key} className="bg-gray-700 p-3 rounded-lg">
                            <p className="text-sm capitalize text-gray-400">{key.replace(/([A-Z])/g, ' $1')}</p>
                            <p className="font-bold text-green-400">{value}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}