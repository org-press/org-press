import{i as m}from"./hydrate-runtime-S5DTWFRe.js";import{s as o,t as u}from"./animation.org_NAME_animation-CWcJ1bJ7.js";import"./preload-helper-BXl3LOEh.js";const r=[{type:"error",content:"Block renders nothing - output is empty",delay:0},{type:"ai",content:"Your block is missing `export function render()`. With `:use dom`, you need to export a render function that returns the rendered output.",delay:800},{type:"user",content:"Yes, add it",delay:1600},{type:"success",content:"Added `export function render() { return <Card>{data}</Card>; }` - now rendering!",delay:2200}];function l(){const e=document.createElement("section");e.className="landing-section ai-chat-section",e.id="ai",e.innerHTML=`
    <div class="section-content">
      <div class="ai-header">
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
          <div class="chat-messages" id="chat-messages">
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
  `;let n=!1;async function v(){const t=e.querySelectorAll(".chat-message");for(let s=0;s<r.length;s++){const a=r[s],i=t[s],d=i?.querySelector(".message-text");!i||!d||(await o(a.delay),i.classList.add("visible"),await u(d,a.content,a.type==="user"?40:20),await o(300))}}const c=new IntersectionObserver(t=>{for(const s of t)s.isIntersecting&&!n&&(n=!0,v(),c.disconnect())},{threshold:.3});return requestAnimationFrame(()=>{c.observe(e)}),e}var g=l();const p=Object.freeze(Object.defineProperty({__proto__:null,createAiChat:l,default:g},Symbol.toStringTag,{value:"Module"})),h={"block-content-landing-sections-ai-chat-org-0":{module:p,ext:"ts",isReact:!1,modeName:"dom"}};m(h);
