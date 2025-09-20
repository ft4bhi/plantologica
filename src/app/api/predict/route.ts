import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini AI client
// Before: empty‐string fallback hides missing key
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// After: assert presence of key at compile time, handle absence in request handler
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
      lightIntensity: "10000-25000 lux"
    },
    'tomato': {
      temperature: "21-27°C",
      humidity: "60-80%",
      soilMoisture: "50-70%",
      ph: "6.0-6.8",
      lightIntensity: "20000-30000 lux"
    },
    'lettuce': {
      temperature: "15-21°C",
      humidity: "50-70%",
      soilMoisture: "50-70%",
      ph: "6.0-7.0",
      lightIntensity: "10000-20000 lux"
    },
    'carrot': {
      temperature: "15-21°C",
      humidity: "40-60%",
      soilMoisture: "40-60%",
      ph: "6.0-6.8",
      lightIntensity: "20000-30000 lux"
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
    const requiredFields = ['temperature', 'humidity', 'soilMoisture', 'ph', 'lightIntensity'];
    const missingFields = requiredFields.filter(field => sensorData[field] === undefined);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if we have an API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        getFallbackData(sensorData),
        { status: 200 }
      );
    }

    try {
      // Create the prompt for Gemini
      const prompt = `
      Analyze these agricultural sensor readings and provide:
      1. An overall assessment of soil and plant health.
      2. Specific problems detected (if any).
      3. Practical recommendations to improve current conditions.
      4. A list of preventative measures to prevent the plant from dying and ensure its long-term health.
      5. The real optimal conditions for the specified plant type, not generic ones.

      Sensor Data:
      - Temperature: ${sensorData.temperature}°C
      - Humidity: ${sensorData.humidity}%
      - Soil Moisture: ${sensorData.soilMoisture}%
      - Soil pH: ${sensorData.ph}
      - Light Intensity: ${sensorData.lightIntensity} lux
      - Plant Type: ${sensorData.plantType || 'Not specified'}

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
          "lightIntensity": "optimal range in lux"
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
        
        return NextResponse.json(prediction);
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        return NextResponse.json(getFallbackData(sensorData));
      }
    } catch (apiError: any) {
      console.error('Gemini API error:', apiError);
      
      // Handle different types of API errors
      if (apiError.status === 429) {
        console.warn('Gemini API quota exceeded, using fallback data');
      } else if (apiError.status === 404) {
        console.warn('Gemini model not found, using fallback data');
      }
      
      return NextResponse.json(getFallbackData(sensorData));
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