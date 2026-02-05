import{i as m}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";const l=[{cmd:"fmt",desc:"Format org files and code blocks"},{cmd:"lint",desc:"Check for style and syntax issues"},{cmd:"test",desc:"Run tests from code blocks"},{cmd:"type-check",desc:"TypeScript type validation"},{cmd:"build",desc:"Build for production"}];function r(){const e=document.createElement("section");e.className="landing-section cli-carousel-section",e.id="cli",e.innerHTML=`
    <div class="section-content">
      <div class="section-text">
        <span class="section-label">Developer Tools</span>
        <h2>Super-Charge Literate Programming</h2>
        <p>
          A complete CLI toolkit for working with org files.
          Format, lint, test, and build your literate documents
          with powerful command-line tools.
        </p>
        <div class="cli-features">
          <div class="cli-feature">
            <strong>orgp fmt</strong> - Auto-format code blocks
          </div>
          <div class="cli-feature">
            <strong>orgp test</strong> - Run inline tests with Vitest
          </div>
          <div class="cli-feature">
            <strong>orgp build</strong> - Production-ready static sites
          </div>
        </div>
      </div>
      <div class="section-visual">
        <div class="cli-window">
          <div class="cli-header">
            <span class="cli-prompt">&gt; orgp</span>
          </div>
          <div class="cli-carousel-container">
            <div class="cli-carousel" id="cli-carousel">
              ${l.map((t,i)=>`
                <div class="cli-item${i===0?" active":""}" data-index="${i}">
                  <span class="cli-cmd">${t.cmd}</span>
                  <span class="cli-desc">${t.desc}</span>
                </div>
              `).join("")}
            </div>
            <div class="cli-highlight"></div>
          </div>
        </div>
      </div>
    </div>
  `;let s=0;function d(){const t=e.getBoundingClientRect(),i=Math.max(0,Math.min(1,(window.innerHeight/2-t.top)/t.height)),n=Math.min(l.length-1,Math.floor(i*l.length));if(n!==s){s=n,e.querySelectorAll(".cli-item").forEach((o,u)=>{o.classList.toggle("active",u===s)});const a=e.querySelector("#cli-carousel");if(a){const o=-s*52;a.style.transform=`translateY(${o}px)`}}}let c=!1;return window.addEventListener("scroll",()=>{c||(requestAnimationFrame(()=>{d(),c=!1}),c=!0)},{passive:!0}),e}var v=r();const g=Object.freeze(Object.defineProperty({__proto__:null,createCarousel:r,default:v},Symbol.toStringTag,{value:"Module"})),p={"block-content-landing-sections-carousel-org-0":{module:g,ext:"ts",isReact:!1,modeName:"dom"}};m(p);
