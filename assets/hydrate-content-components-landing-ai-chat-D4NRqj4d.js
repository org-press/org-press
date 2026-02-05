import{i as r}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";const o=[{type:"error",content:"Error: Cannot find module './utils'",delay:0},{type:"ai",content:"I found the issue. The utils.ts file is missing. Want me to create it with the required exports?",delay:800},{type:"user",content:"Yes, fix it",delay:1600},{type:"success",content:"Done! Created utils.ts with the missing formatDate and parseConfig exports.",delay:2200}];function n(e){return new Promise(t=>setTimeout(t,e))}async function l(e,t,s=25){e.textContent="";for(const a of t)e.textContent+=a,await n(s+Math.random()*15)}function d(){const e=document.createElement("section");e.className="landing-section ai-chat-section",e.id="ai",e.innerHTML=`
    <div class="section-content">
      <div class="ai-header">
        <div class="ai-glow"></div>
        <div class="ai-titles">
          <h2>Built for Humans</h2>
          <h2 class="gold">with AI Powers</h2>
        </div>
        <p class="ai-subtitle">
          Org-press is designed to work seamlessly with AI assistants.
          Literate programming creates perfect context for AI understanding.
        </p>
      </div>

      <div class="chat-demo">
        <div class="chat-window">
          <div class="chat-messages">
            <div class="chat-message error" data-index="0">
              <div class="message-icon error-icon">!</div>
              <div class="message-content">
                <span class="message-text"></span>
              </div>
            </div>
            <div class="chat-message ai" data-index="1">
              <div class="message-icon ai-icon">AI</div>
              <div class="message-content">
                <span class="message-text"></span>
              </div>
            </div>
            <div class="chat-message user" data-index="2">
              <div class="message-icon user-icon">&gt;</div>
              <div class="message-content">
                <span class="message-text"></span>
              </div>
            </div>
            <div class="chat-message success" data-index="3">
              <div class="message-icon success-icon">&#10003;</div>
              <div class="message-content">
                <span class="message-text"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-features">
        <div class="ai-feature">
          <h3>Context-Aware</h3>
          <p>Prose and code together provide rich context for AI understanding</p>
        </div>
        <div class="ai-feature">
          <h3>Executable Specs</h3>
          <p>AI can run, test, and validate changes in real-time</p>
        </div>
        <div class="ai-feature">
          <h3>Self-Documenting</h3>
          <p>Changes are naturally documented in literate style</p>
        </div>
      </div>
    </div>
  `;let t=!1;const s=new IntersectionObserver(a=>{for(const i of a)i.isIntersecting&&!t&&(t=!0,v(e),s.disconnect())},{threshold:.3});return requestAnimationFrame(()=>{s.observe(e)}),e}async function v(e){const t=e.querySelectorAll(".chat-message");for(let s=0;s<o.length;s++){const a=o[s],i=t[s],c=i?.querySelector(".message-text");!i||!c||(await n(a.delay),i.classList.add("visible"),await l(c,a.content,a.type==="user"?40:20),await n(300))}}var m=d();const u=Object.freeze(Object.defineProperty({__proto__:null,createAiChat:d,default:m},Symbol.toStringTag,{value:"Module"})),g={"block-content-components-landing-ai-chat-org-0":{module:u,ext:"ts",isReact:!1,modeName:"dom"}};r(g);
