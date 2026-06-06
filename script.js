// ==================== GEMINI API KEY (from your image) ====================
const GEMINI_API_KEY = "AQ.Ab8RN6ImuFGUB8VsH0OrxqoOOVjXiEKY8qZyL5l6aa7-wXeZ3w";

// ==================== MONACO EDITOR INITIALIZATION ====================
let editor = null;

// Default buggy Python code (missing colon)
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

// Configure Monaco loader
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
            lineNumbers: 'on'
        });
        console.log('✅ Monaco Editor ready');
    } else {
        console.error('❌ Editor container not found');
    }
});

// ==================== UI ELEMENTS ====================
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingStatus = document.getElementById('loading-status');
const errorDisplay = document.getElementById('error-display');
const explanationList = document.getElementById('explanation-display');

function showLoading() {
    if (loadingStatus) loadingStatus.classList.remove('hidden');
    if (errorDisplay) errorDisplay.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Analyzing...';
    if (explanationList) explanationList.innerHTML = '<li><i class="fas fa-spinner fa-pulse"></i> AI is generating step‑by‑step guide...</li>';
}

function hideLoading() {
    if (loadingStatus) loadingStatus.classList.add('hidden');
}

function displayResults(errorType, explanationSteps) {
    if (errorDisplay) errorDisplay.innerHTML = errorType || 'Unknown error';
    if (explanationList) {
        explanationList.innerHTML = '';
        if (Array.isArray(explanationSteps) && explanationSteps.length) {
            explanationSteps.forEach(step => {
                const li = document.createElement('li');
                li.textContent = step;
                explanationList.appendChild(li);
            });
        } else {
            explanationList.innerHTML = '<li>⚠️ No detailed explanation received.</li>';
        }
    }
}

function displayError(errMsg) {
    if (errorDisplay) errorDisplay.innerHTML = `⚠️ API Error: ${errMsg}`;
    if (explanationList) explanationList.innerHTML = '<li>❌ Could not analyze code. Check console or API key.</li>';
}

// ==================== GEMINI API CALL ====================
async function callGeminiAPI(code) {
    const systemInstruction = {
        parts: [{ text: `You are a strict coding tutor. Analyze the provided code for errors. Return ONLY a valid JSON object without any markdown. The JSON must follow this structure: {"error_type": "string", "step_by_step_explanation": ["string", "string"]}.` }]
    };
    const userMessage = {
        parts: [{ text: `Python code:\n\n${code}` }]
    };
    const requestBody = {
        system_instruction: systemInstruction,
        contents: [{ role: "user", parts: userMessage.parts }],
        generationConfig: { temperature: 0.2, topP: 0.9 }
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`HTTP ${response.status}: ${errData.error?.message || 'Unknown error'}`);
    }
    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('Empty response from Gemini');

    // Clean potential markdown fences
    let clean = generatedText.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/```json\n?/, '').replace(/```\n?/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/```\n?/g, '');

    const parsed = JSON.parse(clean);
    if (typeof parsed.error_type !== 'string' || !Array.isArray(parsed.step_by_step_explanation)) {
        throw new Error('Invalid JSON structure from AI');
    }
    return parsed;
}

// ==================== BUTTON CLICK HANDLER ====================
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        if (!editor) {
            displayError('Editor not ready. Please wait a moment.');
            return;
        }
        const currentCode = editor.getValue();
        console.log('🔍 Code sent to Gemini:\n', currentCode);

        showLoading();
        try {
            const result = await callGeminiAPI(currentCode);
            displayResults(result.error_type, result.step_by_step_explanation);
        } catch (err) {
            console.error('Gemini error:', err);
            displayError(err.message);
        } finally {
            hideLoading();
        }
    });
} else {
    console.error('❌ Analyze button (#analyzeBtn) not found');
}

// Initially hide loading status
if (loadingStatus) loadingStatus.classList.add('hidden');
