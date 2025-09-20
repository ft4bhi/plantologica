import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WeatherData, WeatherImpact } from '@/app/type';

// Initialize the Gemini AI client
// Before: empty‐string fallback hides missing key
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// After: assert presence of key at compile time, handle absence in request handler
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Function to fetch weather data
async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      console.warn('OpenWeatherMap API key not found');
      return null;
    }

    // First, get basic weather data for city name
    const basicUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const basicResponse = await fetch(basicUrl);
    
    if (!basicResponse.ok) {
      console.error(`Basic Weather API error: ${basicResponse.status}`);
      return null;
    }

    const basicData = await basicResponse.json();
    const cityName = basicData.name;

    // Try One Call API 2.5 for UV Index
    const oneCallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const oneCallResponse = await fetch(oneCallUrl);
    
    let uvIndex = null;
    if (oneCallResponse.ok) {
      const oneCallData = await oneCallResponse.json();
      uvIndex = oneCallData.current?.uvi;
    } else {
      console.warn(`One Call API error: ${oneCallResponse.status}, UV Index not available`);
    }
    
    return {
      temperature: basicData.main.temp, // Keep API temp for reference, but will use user input
      humidity: basicData.main.humidity, // Keep API humidity for reference, but will use user input
      description: basicData.weather[0].description,
      windSpeed: basicData.wind.speed,
      pressure: basicData.main.pressure,
      visibility: basicData.visibility / 1000, // Convert to km
      uvIndex: uvIndex,
      location: cityName,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

// Function to analyze weather impact on plants
function analyzeWeatherImpact(weatherData: WeatherData, sensorData: any): WeatherImpact {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const weatherAlerts: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Use user-provided temperature and humidity for analysis
  const userTemp = sensorData.temperature;
  const userHumidity = sensorData.humidity;

  // Temperature analysis using user input
  if (userTemp < 5) {
    issues.push('Frost risk - temperatures below 5°C');
    weatherAlerts.push('FROST WARNING: Protect plants from freezing temperatures');
    recommendations.push('Cover plants with frost cloth or move indoors');
    riskLevel = 'high';
  } else if (userTemp > 35) {
    issues.push('Heat stress - temperatures above 35°C');
    weatherAlerts.push('HEAT WARNING: High temperatures may stress plants');
    recommendations.push('Increase watering frequency and provide shade');
    riskLevel = 'high';
  } else if (userTemp < 10 || userTemp > 30) {
    issues.push('Suboptimal temperature range');
    recommendations.push('Monitor plant health closely due to temperature stress');
    riskLevel = 'medium';
  }

  // Humidity analysis using user input
  if (userHumidity > 90) {
    issues.push('Excessive humidity - risk of fungal diseases');
    recommendations.push('Improve air circulation and avoid overhead watering');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  } else if (userHumidity < 30) {
    issues.push('Low humidity - plants may dry out quickly');
    recommendations.push('Increase watering frequency and consider misting');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  // Wind analysis
  if (weatherData.windSpeed > 15) {
    issues.push('High wind speeds - may damage plants');
    weatherAlerts.push('WIND WARNING: Strong winds may damage plants');
    recommendations.push('Stake tall plants and protect from wind damage');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  // Pressure analysis (storm prediction)
  if (weatherData.pressure < 1000) {
    issues.push('Low atmospheric pressure - storm conditions possible');
    weatherAlerts.push('STORM WARNING: Low pressure indicates potential severe weather');
    recommendations.push('Secure loose items and prepare for heavy rain');
    riskLevel = 'high';
  }

  // UV Index analysis
  if (weatherData.uvIndex && weatherData.uvIndex > 8) {
    issues.push('High UV index - may cause sunburn on plants');
    recommendations.push('Provide shade during peak sun hours');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  // Visibility analysis (fog/haze)
  if (weatherData.visibility < 1) {
    issues.push('Poor visibility - foggy conditions may affect photosynthesis');
    recommendations.push('Monitor for signs of reduced light absorption');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  return {
    riskLevel,
    issues,
    recommendations,
    weatherAlerts
  };
}

// Fallback data for when API is unavailable
const getFallbackData = (sensorData: any) => {
  const recommendations = [];
  let assessment = "Conditions appear generally favorable";

  // Plant-specific optimal conditions lookup table
  const plantOptimalConditions: { [key: string]: any } = {
    'default': {
      temperature: "18-25°C",
      humidity: "40-70%",
      soilMoisture: "30-60%",
      ph: "6.0-7.0",
      lightIntensity: "10000-25000 lux",
      Nitrogen: "100-200 ppm",
      Phosphorus: "40-100 ppm",
      Potassium: "100-200 ppm"
    },
    'tomato': {
      temperature: "21-27°C",
      humidity: "60-80%",
      soilMoisture: "50-70%",
      ph: "6.0-6.8",
      lightIntensity: "20000-30000 lux",
      Nitrogen: "150-250 ppm",
      Phosphorus: "60-80 ppm",
      Potassium: "200-300 ppm"
    },
    'lettuce': {
      temperature: "15-21°C",
      humidity: "50-70%",
      soilMoisture: "50-70%",
      ph: "6.0-7.0",
      lightIntensity: "10000-20000 lux",
      Nitrogen: "100-150 ppm",
      Phosphorus: "40-60 ppm",
      Potassium: "150-250 ppm"
    },
    'carrot': {
      temperature: "15-21°C",
      humidity: "40-60%",
      soilMoisture: "40-60%",
      ph: "6.0-6.8",
      lightIntensity: "20000-30000 lux",
      Nitrogen: "80-120 ppm",
      Phosphorus: "50-100 ppm",
      Potassium: "150-250 ppm"
    }
    // Add more plants here
  };

  const plantType = sensorData.plantType?.toLowerCase() || 'default';
  const optimalConditions = plantOptimalConditions[plantType] || plantOptimalConditions['default'];

  // pH analysis
  if (sensorData.ph < 5.5) {
    recommendations.push("Add lime to increase soil pH level (currently too acidic)");
    assessment = "Soil is too acidic";
  } else if (sensorData.ph > 7.5) {
    recommendations.push("Add sulfur or organic matter to decrease soil pH (currently too alkaline)");
    assessment = "Soil is too alkaline";
  }

  // Soil moisture analysis
  if (sensorData.soilMoisture < 30) {
    recommendations.push("Water plants thoroughly as soil moisture is low");
    assessment = "Soil moisture is insufficient";
  } else if (sensorData.soilMoisture > 70) {
    recommendations.push("Reduce watering to prevent root rot");
    assessment = "Soil is too wet";
  }

  // Temperature analysis
  if (sensorData.temperature < 15) {
    recommendations.push("Consider using plant covers to protect from cold");
    assessment = "Temperature is too low for optimal growth";
  } else if (sensorData.temperature > 30) {
    recommendations.push("Provide shade during hottest parts of the day");
    assessment = "Temperature is too high for optimal growth";
  }

  // Light analysis
  if (sensorData.lightIntensity < 10000) {
    recommendations.push("Increase light exposure or consider artificial lighting");
    assessment = "Light intensity is insufficient";
  } else if (sensorData.lightIntensity > 30000) {
    recommendations.push("Provide some shading to prevent light stress");
    assessment = "Light intensity is excessive";
  }

  // Nitrogen analysis
  if (sensorData.Nitrogen < 80) {
    recommendations.push("Add a nitrogen-rich fertilizer to boost leaf growth.");
    assessment = "Nitrogen levels are low";
  } else if (sensorData.Nitrogen > 250) {
    recommendations.push("Reduce nitrogen application to prevent burn and encourage fruiting.");
    assessment = "Nitrogen levels are too high";
  }

  // Phosphorus analysis
  if (sensorData.Phosphorus < 40) {
    recommendations.push("Apply a phosphorus supplement to improve root and flower development.");
    assessment = "Phosphorus levels are low";
  } else if (sensorData.Phosphorus > 100) {
    recommendations.push("Avoid phosphorus fertilizers for now.");
    assessment = "Phosphorus levels are too high";
  }

  // Potassium analysis
  if (sensorData.Potassium < 100) {
    recommendations.push("Supplement with potassium to enhance overall plant vigor and disease resistance.");
    assessment = "Potassium levels are low";
  } else if (sensorData.Potassium > 250) {
    recommendations.push("Leach soil with water to reduce high potassium levels.");
    assessment = "Potassium levels are too high";
  }

  if (recommendations.length === 0) {
    recommendations.push("Conditions appear generally favorable. Monitor regularly.");
  }

  return {
    assessment,
    problems: ["Unable to get AI analysis due to API issues"],
    recommendations,
    optimalConditions
  };
};

export async function POST(request: NextRequest) {
  try {
    const sensorData = await request.json();

    // Validate required fields
    const requiredFields = ['temperature', 'humidity', 'soilMoisture', 'ph', 'lightIntensity', 'Nitrogen', 'Phosphorus', 'Potassium'];
    const missingFields = requiredFields.filter(field => sensorData[field] === undefined);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch weather data if coordinates are provided
    let weatherData: WeatherData | null = null;
    let weatherImpact: WeatherImpact | null = null;
    
    if (sensorData.latitude && sensorData.longitude) {
      weatherData = await fetchWeatherData(sensorData.latitude, sensorData.longitude);
      if (weatherData) {
        weatherImpact = analyzeWeatherImpact(weatherData, sensorData);
      }
    }

    // Check if we have an API key
    if (!process.env.GEMINI_API_KEY) {
      const fallbackData = getFallbackData(sensorData);
      return NextResponse.json({
        ...fallbackData,
        weatherData,
        weatherImpact
      }, { status: 200 });
    }

    try {
      // Create the prompt for Gemini
      const weatherContext = weatherData ? `
      
      Current Weather Conditions (from weather API):
      - Weather Description: ${weatherData.description}
      - Wind Speed: ${weatherData.windSpeed} m/s
      - Atmospheric Pressure: ${weatherData.pressure} hPa
      - Visibility: ${weatherData.visibility} km
      - UV Index: ${weatherData.uvIndex !== null && weatherData.uvIndex !== undefined ? weatherData.uvIndex : 'Not Available'}
      - Location: ${weatherData.location}
      
      Note: Temperature and humidity values are provided by the user (not from weather API)
      
      Weather Impact Analysis:
      ${weatherImpact ? `
      - Risk Level: ${weatherImpact.riskLevel.toUpperCase()}
      - Weather Issues: ${weatherImpact.issues.join(', ')}
      - Weather Alerts: ${weatherImpact.weatherAlerts.join(', ')}
      ` : 'No weather data available'}
      ` : '';

      const prompt = `
      Analyze these agricultural sensor readings${weatherData ? ' along with current weather conditions' : ''} and provide:
      1. An overall assessment of soil and plant health.
      2. Specific problems detected (if any).
      3. Practical recommendations to improve current conditions.
      4. A list of preventative measures to prevent the plant from dying and ensure its long-term health.
      5. The real optimal conditions for the specified plant type, not generic ones.
      ${weatherData ? '6. Weather-specific recommendations for plant protection and care.' : ''}

      Sensor Data:
      - Temperature: ${sensorData.temperature}°C
      - Humidity: ${sensorData.humidity}%
      - Soil Moisture: ${sensorData.soilMoisture}%
      - Soil pH: ${sensorData.ph}
      - Light Intensity: ${sensorData.lightIntensity} lux
      - Nitrogen: ${sensorData.Nitrogen} ppm
      - Phosphorus: ${sensorData.Phosphorus} ppm
      - Potassium: ${sensorData.Potassium} ppm
      - Plant Type: ${sensorData.plantType || 'Not specified'}
      ${weatherContext}

      Format your response as a JSON object with this exact structure:
      {
        "assessment": "overall assessment text",
        "problems": ["problem1", "problem2", ...],
        "recommendations": ["recommendation1", "recommendation2", ...],
        "preventativeCare": ["care_tip1", "care_tip2", ...],
        "optimalConditions": {
          "temperature": "optimal range in °C",
          "humidity": "optimal range in %",
          "soilMoisture": "optimal range in %",
          "ph": "optimal pH range",
          "lightIntensity": "optimal range in lux",
          "nitrogen": "optimal range in ppm",
          "phosphorus": "optimal range in ppm",
          "potassium": "optimal range in ppm"
        }
      }
      Please provide only the JSON response without any additional text.
    `;

      // Use the latest flash model for speed and compatibility
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      
      // Generate content
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Try to extract JSON from the response
      try {
        const jsonString = text.replace(/```json|```/g, '').trim();
        const prediction = JSON.parse(jsonString);
        
        return NextResponse.json({
          ...prediction,
          weatherData,
          weatherImpact
        });
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        const fallbackData = getFallbackData(sensorData);
        return NextResponse.json({
          ...fallbackData,
          weatherData,
          weatherImpact
        });
      }
    } catch (apiError: any) {
      console.error('Gemini API error:', apiError);
      
      // Handle different types of API errors
      if (apiError.status === 429) {
        console.warn('Gemini API quota exceeded, using fallback data');
      } else if (apiError.status === 404) {
        console.warn('Gemini model not found, using fallback data');
      }
      
      const fallbackData = getFallbackData(sensorData);
      return NextResponse.json({
        ...fallbackData,
        weatherData,
        weatherImpact
      });
    }

  } catch (error) {
    console.error('Error in prediction API:', error);
    // Return error response since we can't parse the request body again
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}