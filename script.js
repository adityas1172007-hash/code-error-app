// ==================== 🔑 API KEY ====================
const GEMINI_API_KEY = "AQ.Ab8RN6ImuFGUB8VsH0OrxqoOOVjXiEKY8qZyL5l6aa7-wXeZ3w";

// ==================== SETUP CODEMIRROR ====================
const buggyCode = `def calculate_average(numbers):
    total = 0
    # BUG: missing colon ':' after 'for num in numbers'
    for num in numbers
        total += num
    average = total / len(numbers)
    return average

scores = [85, 92, 78, 90, 88]
result = calculate_average(scores)
print(f"Class average: {result}")
`;

const textarea = document.getElementById('code-editor');
const editor = CodeMirror.fromTextArea(textarea, {
  mode: 'python',
  theme: 'material-darker',
  lineNumbers: true,
  autoCloseBrackets: true,
  indentUnit: 4,
  tabSize: 4,
  lineWrapping: true,
  viewportMargin: Infinity
});

editor.setValue(buggyCode);
setTimeout(() => editor.refresh(), 100);

// ==================== UI ELEMENTS & LOGIC ====================
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingDiv = document.getElementById('loading-status');
const errorDisplayDiv = document.getElementById('error-display');
const explanationUl = document.getElementById('explanation-list');

function showLoading() {
  loadingDiv.classList.remove('hidden');
  errorDisplayDiv.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Analyzing...';
  explanationUl.innerHTML = '<li><i class="fas fa-spinner fa-pulse"></i> AI is thinking...</li>';
  analyzeBtn.disabled = true;
}

function hideLoading() {
  loadingDiv.classList.add('hidden');
  analyzeBtn.disabled = false;
}

function displayResults(errorType, steps) {
  errorDisplayDiv.innerHTML = errorType || 'Unknown error';
  explanationUl.innerHTML = '';
  
  if (steps && steps.length > 0) {
    steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      explanationUl.appendChild(li);
    });
  } else {
    explanationUl.innerHTML = '<li>⚠️ No detailed explanation received.</li>';
  }
}

function displayError(msg) {
  errorDisplayDiv.innerHTML = `⚠️ Error`;
  explanationUl.innerHTML = `<li>❌ ${msg}. Check console for details.</li>`;
}

// ==================== GEMINI API (FIXED LOGIC) ====================
async function callGemini(code) {
  const systemPrompt = `You are a strict coding tutor. Analyze the provided code for errors. Return ONLY a valid JSON object. The JSON must follow: {"error_type": "string", "step_by_step_explanation": ["string", "string"]}.`;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] }, 
    contents: [{ role: "user", parts: [{ text: `Python code:\n${code}` }] }],
    generationConfig: { 
      temperature: 0.2,
      responseMimeType: "application/json" 
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) throw new Error('Empty response');

  const parsed = JSON.parse(text);
  
  if (!parsed.error_type || !Array.isArray(parsed.step_by_step_explanation)) {
      throw new Error('Invalid JSON structure');
  }
  
  return parsed;
}

// ==================== BUTTON CLICK ====================
analyzeBtn.addEventListener('click', async () => {
  const currentCode = editor.getValue();
  console.log('📝 Code:', currentCode);
  
  showLoading();
  
  try {
    const result = await callGemini(currentCode);
    displayResults(result.error_type, result.step_by_step_explanation);
  } catch (err) {
    console.error("API Fetch Error: ", err);
    displayError(err.message);
  } finally {
    hideLoading();
  }
});
