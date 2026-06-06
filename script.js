// ==================== GEMINI API CONFIGURATION ====================
// ⚠️ IMPORTANT: Replace with your actual Gemini API key before using
const GEMINI_API_KEY = "YOUR_API_KEY_HERE";  // <-- Paste your valid API key here

// ==================== MONACO EDITOR INITIALIZATION ====================
let editor = null;

// Default buggy Python code (syntax error + logical demo)
const defaultPythonCode = `def calculate_average(numbers):
    total = 0
    # BUG: missing colon ':' after 'for num in numbers'
    for num in numbers
        total += num
    average = total / len(numbers)
    return average

# Test list
scores = [85, 92, 78, 90, 88]
result = calculate_average(scores)
print(f"Class average: {result}")
print("Calculation finished")
`;

// Configure Monaco loader and create editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function() {
    const container = document.getElementById('editor-container');
    if (container) {
        editor = monaco.editor.create(container, {
            value: defaultPythonCode,
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderWhitespace: 'selection'
        });
        console.log('✅ Monaco Editor initialized with Python code');
    } else {
        console.error('❌ Editor container (#editor-container) not found');
    }
});

// ==================== UI ELEMENTS ====================
const analyzeBtn = document.getElementById('analyze-btn');
const loadingStatus = document.getElementById('loading-status');
const errorDisplay = document.getElementById('error-display');
const explanationList = document.getElementById('explanation-display');

// Helper: Clear previous AI results
function clearResults() {
    if (errorDisplay) {
        const errorMsgP = errorDisplay.querySelector('.error-message-placeholder');
        if (errorMsgP) errorMsgP.textContent = '';
    }
    if (explanationList) {
        explanationList.innerHTML = '';
    }
}

// Helper: Show loading spinner, hide previous content
function showLoading() {
    if (loadingStatus) loadingStatus.classList.remove('hidden');
    clearResults();
}

// Helper: Hide loading spinner
function hideLoading() {
    if (loadingStatus) loadingStatus.classList.add('hidden');
}

// Helper: Display error type and step‑by‑step explanation
function displayAnalysisResult(errorType, explanationArray) {
    // Update error type section
    if (errorDisplay) {
        const errorMsgP = errorDisplay.querySelector('.error-message-placeholder');
        if (errorMsgP) {
            errorMsgP.textContent = errorType || 'Unknown error';
        }
    }
    // Populate explanation list
    if (explanationList && Array.isArray(explanationArray)) {
        explanationList.innerHTML = '';
        explanationArray.forEach(step => {
            const li = document.createElement('li');
            li.textContent = step;
            explanationList.appendChild(li);
        });
    } else if (explanationList) {
        explanationList.innerHTML = '<li>⚠️ No step‑by‑step explanation received.</li>';
    }
}

// Helper: Show error message in UI when API fails
function showFetchError(message) {
    if (errorDisplay) {
        const errorMsgP = errorDisplay.querySelector('.error-message-placeholder');
        if (errorMsgP) {
            errorMsgP.textContent = `⚠️ API Error: ${message}`;
        }
    }
    if (explanationList) {
        explanationList.innerHTML = '<li>❌ Failed to analyze code. Check console or API key.</li>';
    }
}

// ==================== GEMINI API CALL ====================
async function analyzeCodeWithGemini(codeSnippet) {
    // System prompt as required (strict JSON output)
    const systemInstruction = {
        parts: [{ text: `You are a strict coding tutor. Analyze the provided code for errors. Return ONLY a valid JSON object without any markdown. The JSON must follow this structure: {"error_type": "string", "step_by_step_explanation": ["string", "string"]}.` }]
    };

    const userMessage = {
        parts: [{ text: `Here is the Python code to analyze:\n\n${codeSnippet}` }]
    };

    const requestBody = {
        system_instruction: systemInstruction,
        contents: [
            {
                role: "user",
                parts: userMessage.parts
            }
        ],
        generationConfig: {
            temperature: 0.2,
            topP: 0.9,
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API responded with ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();

        // Extract the text content from Gemini response
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!generatedText) {
            throw new Error('Empty response from Gemini');
        }

        // Clean potential markdown fences (just in case, though system prompt asks not to)
        let cleanJson = generatedText.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanJson);
        // Validate expected structure
        if (typeof parsed.error_type !== 'string' || !Array.isArray(parsed.step_by_step_explanation)) {
            throw new Error('Invalid JSON structure from AI');
        }
        return parsed;
    } catch (err) {
        console.error('Gemini API error:', err);
        throw err;
    }
}

// ==================== BUTTON CLICK HANDLER ====================
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        // Guard: ensure editor is ready
        if (!editor) {
            console.warn('Monaco editor not ready yet.');
            showFetchError('Editor not initialized');
            return;
        }

        // 1. Show loading UI
        showLoading();

        // 2. Get code from Monaco
        const currentCode = editor.getValue();
        console.log('📟 [code ERROR] Extracted Code for Gemini:');
        console.log(currentCode);
        console.log(`📊 Code length: ${currentCode.length} characters`);

        // 3. Call Gemini API
        try {
            const result = await analyzeCodeWithGemini(currentCode);
            // 4. Update UI with results
            displayAnalysisResult(result.error_type, result.step_by_step_explanation);
        } catch (error) {
            console.error('Analysis failed:', error);
            showFetchError(error.message || 'Could not analyze code');
        } finally {
            // 5. Hide loading indicator
            hideLoading();
        }
    });
} else {
    console.error('❌ Analyze button (#analyze-btn) not found');
}

// Initially hide loading status (it's hidden by CSS class)
if (loadingStatus) loadingStatus.classList.add('hidden');