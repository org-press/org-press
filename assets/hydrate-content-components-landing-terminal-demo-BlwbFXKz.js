import{i as c}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";function n(e){return new Promise(t=>setTimeout(t,e))}async function o(e,t,a=50,i=0){await n(i),e.textContent="";for(const s of t)e.textContent+=s,await n(a+Math.random()*20)}function r(){const e=document.createElement("section");e.className="landing-section terminal-demo-section",e.id="ssg",e.innerHTML=`
    <div class="section-content">
      <div class="section-visual">
        <div class="terminal-window">
          <div class="terminal-header">
            <span class="terminal-dot red"></span>
            <span class="terminal-dot yellow"></span>
            <span class="terminal-dot green"></span>
            <span class="terminal-title">Terminal</span>
          </div>
          <div class="terminal-body">
            <div class="terminal-line">
              <span class="terminal-prompt">$</span>
              <span class="terminal-command" data-text="orgp dev"></span>
              <span class="terminal-cursor">|</span>
            </div>
            <div class="terminal-output">
              <div class="output-line ready" data-text=""></div>
              <div class="output-line url" data-text=""></div>
              <div class="output-line info" data-text=""></div>
            </div>
          </div>
        </div>
      </div>
      <div class="section-text">
        <span class="section-label">Static Site Generator</span>
        <h2>Document Format for Web Development</h2>
        <p>
          Org-press is a static site generator built for literate programming.
          Hot module replacement, instant preview, and production builds
          with a single command.
        </p>
        <ul class="feature-list">
          <li>Lightning-fast Vite-powered dev server</li>
          <li>TypeScript, JSX, CSS out of the box</li>
          <li>Server-side execution at build time</li>
          <li>Automatic syntax highlighting</li>
        </ul>
      </div>
    </div>
  `;let t=!1;const a=new IntersectionObserver(i=>{for(const s of i)s.isIntersecting&&!t&&(t=!0,d(e),a.disconnect())},{threshold:.3});return requestAnimationFrame(()=>{a.observe(e)}),e}async function d(e){const t=e.querySelector(".terminal-command"),a=e.querySelector(".terminal-cursor"),i=e.querySelector(".output-line.ready"),s=e.querySelector(".output-line.url"),l=e.querySelector(".output-line.info");!t||!a||(await o(t,"orgp dev",80),a.style.opacity="0",await n(200),a.style.display="none",await n(300),i&&(i.textContent="",i.classList.add("visible"),await o(i,"Ready in 127ms",30)),await n(150),s&&(s.classList.add("visible"),s.innerHTML='<span class="dim">Local:</span>   <span class="url-link">http://localhost:3000/</span>'),await n(100),l&&(l.classList.add("visible"),l.innerHTML='<span class="dim">press</span> <span class="key">h + enter</span> <span class="dim">to show help</span>'))}var m=r();const p=Object.freeze(Object.defineProperty({__proto__:null,createTerminalDemo:r,default:m},Symbol.toStringTag,{value:"Module"})),u={"block-content-components-landing-terminal-demo-org-0":{module:p,ext:"ts",isReact:!1,modeName:"dom"}};c(u);
