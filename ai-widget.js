/* ai-widget.js — Sci-Guru chat widget logic (frontend-only)
   It will call your Render backend. Set it like:
   window.SG_BACKEND_URL = "https://YOUR-APP.onrender.com";
*/

(function(){
  // ====== CONFIG ======
  const DEFAULT_BACKEND = ""; // leave empty if you will set window.SG_BACKEND_URL in tutor.html
  const BACKEND_URL = (window.SG_BACKEND_URL || DEFAULT_BACKEND || "").replace(/\/+$/,"");

  // Try these endpoints on your backend (first that works will be used)
  const ENDPOINTS = [
    "/api/chat",
    "/chat"
  ];

  // LocalStorage key for chat history
  const LS_KEY = "sg_chat_history_v1";

  // ====== Helpers ======
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowTime = () => new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});

  function safeParse(json, fallback){
    try { return JSON.parse(json); } catch(e){ return fallback; }
  }

  function getExistingTutorValue(){
    // If your tutor already has these fields, we use them automatically.
    const formEl = document.querySelector("#formSelect, #form, [data-sg-form]");
    const topicEl = document.querySelector("#topicInput, #topic, [data-sg-topic]");
    return {
      form: formEl ? (formEl.value || formEl.textContent || "").trim() : "",
      topic: topicEl ? (topicEl.value || topicEl.textContent || "").trim() : ""
    };
  }

  function loadHistory(){
    const data = safeParse(localStorage.getItem(LS_KEY), []);
    return Array.isArray(data) ? data : [];
  }

  function saveHistory(arr){
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-40))); // keep last 40
  }

  // ====== UI Mount ======
  function mount(){
    const mountEl = document.getElementById("sg-ai-widget");
    if(!mountEl) return;

    mountEl.innerHTML = `
      <div class="sgw-head">
        <div>
          <div class="sgw-title">
            <span class="sgw-dot" id="sgwDot"></span>
            <div>
              Sci-Guru AI Tutor
              <div class="sgw-sub" id="sgwStatus">Not connected</div>
            </div>
          </div>
        </div>
        <div class="sgw-actions">
          <button class="sgw-btn" id="sgwClear">Clear</button>
          <button class="sgw-btn" id="sgwTest">Test</button>
        </div>
      </div>

      <div class="sgw-body">
        <div class="sgw-row">
          <div class="sgw-mini">
            <div style="font-size:12px;color:rgba(234,242,255,.72);font-weight:800;margin-bottom:6px;">Form</div>
            <select id="sgwForm">
              <option value="Form 1" selected>Form 1</option>
              <option value="Form 2">Form 2</option>
              <option value="Form 3">Form 3</option>
              <option value="Form 4">Form 4</option>
            </select>
          </div>
          <div class="sgw-mini">
            <div style="font-size:12px;color:rgba(234,242,255,.72);font-weight:800;margin-bottom:6px;">Topic (optional)</div>
            <input id="sgwTopic" placeholder="e.g., Nutrition, Respiration, Electricity"/>
          </div>
        </div>

        <div class="sgw-chips">
          <button class="sgw-chip" data-q="Explain this topic simply.">Explain simply</button>
          <button class="sgw-chip" data-q="Give me 5 revision questions with answers.">Revision Qs</button>
          <button class="sgw-chip" data-q="Give me a practical experiment I can do at school.">Practical</button>
          <button class="sgw-chip" data-q="Make a 10-question quiz.">Quiz</button>
        </div>

        <div class="sgw-chat" id="sgwChat"></div>

        <div class="sgw-compose">
          <input id="sgwInput" placeholder="Type your question… (Press Enter to send)" />
          <button class="sgw-send" id="sgwSend">Send</button>
        </div>

        <div class="sgw-hint">
          If you see “Not connected”, set <b>window.SG_BACKEND_URL</b> to your Render backend URL.
        </div>
      </div>
    `;

    // Load old messages
    const history = loadHistory();
    const chat = $("#sgwChat");
    history.forEach(m => addMsg(m.role, m.text, m.time, false));
    chat.scrollTop = chat.scrollHeight;

    // Prefill from tutor if available
    const t = getExistingTutorValue();
    if(t.form) $("#sgwForm").value = t.form;
    if(t.topic) $("#sgwTopic").value = t.topic;

    // Events
    $("#sgwSend").addEventListener("click", sendMsg);
    $("#sgwInput").addEventListener("keydown", (e)=>{
      if(e.key === "Enter") sendMsg();
    });
    $("#sgwClear").addEventListener("click", ()=>{
      localStorage