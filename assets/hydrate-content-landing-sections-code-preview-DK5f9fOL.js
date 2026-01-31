import{i}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";function l(){const e=document.createElement("section");e.className="landing-section code-preview-section",e.id="code-blocks";let n=0;const o=["#ff6b6b","#4ecdc4","#ffe66d","#95e1d3"];return e.innerHTML=`
    <div class="section-content">
      <div class="section-text">
        <span class="section-label">Executable Code</span>
        <h2>Codeblocks with Superpowers</h2>
        <p>
          Your code blocks aren't just syntax-highlighted text.
          They execute in the browser with full TypeScript, JSX, and CSS support.
          Click the button to see it in action.
        </p>
        <div class="demo-button-area">
          <button class="counter-btn" type="button" id="counter-trigger">
            Clicked 0 times
          </button>
        </div>
      </div>
      <div class="section-visual">
        <div class="code-block-preview code-tabs-container">
          <div class="code-tabs">
            <button class="code-tab active" data-tab="react">:use react</button>
            <button class="code-tab" data-tab="dom">:use dom</button>
          </div>
          <div class="code-tab-content active" data-content="react">
            <pre class="code-content"><code><span class="code-keyword">#+begin_src</span> <span class="code-type">tsx</span> <span class="code-attr">:use react</span>
<span class="code-keyword">import</span> { useState } <span class="code-keyword">from</span> <span class="code-string">'react'</span>;

<span class="code-keyword">export function</span> <span class="code-var">render</span>() {
  <span class="code-keyword">const</span> [count, setCount] = useState(<span class="code-number">0</span>);
  <span class="code-keyword">return</span> (
    <span class="code-tag">&lt;button</span> <span class="code-attr">onClick</span>={() => setCount(c => c + <span class="code-number">1</span>)}<span class="code-tag">&gt;</span>
      Clicked {count} times
    <span class="code-tag">&lt;/button&gt;</span>
  );
}
<span class="code-keyword">#+end_src</span></code></pre>
          </div>
          <div class="code-tab-content" data-content="dom">
            <pre class="code-content"><code><span class="code-keyword">#+begin_src</span> <span class="code-type">typescript</span> <span class="code-attr">:use dom</span>
<span class="code-keyword">let</span> count = <span class="code-number">0</span>;
<span class="code-keyword">const</span> btn = document.createElement(<span class="code-string">'button'</span>);
btn.textContent = <span class="code-string">'Clicked '</span> + count + <span class="code-string">' times'</span>;
btn.onclick = () => {
  count++;
  btn.textContent = <span class="code-string">'Clicked '</span> + count + <span class="code-string">' times'</span>;
};

<span class="code-keyword">export function</span> <span class="code-var">render</span>() { <span class="code-keyword">return</span> btn; }
<span class="code-keyword">#+end_src</span></code></pre>
          </div>
        </div>
      </div>
    </div>
  `,requestAnimationFrame(()=>{const s=e.querySelector("#counter-trigger");s&&s.addEventListener("click",()=>{n++,s.textContent=`Clicked ${n} times`,s.style.background=o[n%o.length]}),e.querySelectorAll(".code-tab").forEach(t=>{t.addEventListener("click",()=>{const d=t.getAttribute("data-tab"),c=t.closest(".code-tabs-container");if(!c||!d)return;c.querySelectorAll(".code-tab").forEach(a=>a.classList.remove("active")),t.classList.add("active"),c.querySelectorAll(".code-tab-content").forEach(a=>a.classList.remove("active"));const r=c.querySelector(`[data-content="${d}"]`);r&&r.classList.add("active")})})}),e}var p=l();const u=Object.freeze(Object.defineProperty({__proto__:null,createCodePreview:l,default:p},Symbol.toStringTag,{value:"Module"})),b={"block-content-landing-sections-code-preview-org-0":{module:u,ext:"ts",isReact:!1,modeName:"dom"}};i(b);
