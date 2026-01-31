import{i as p}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";const l=[{cmd:"fmt",desc:"Format org files and code blocks"},{cmd:"lint",desc:"Check for style and syntax issues"},{cmd:"test",desc:"Run tests from code blocks"},{cmd:"type-check",desc:"TypeScript type validation"},{cmd:"build",desc:"Build for production"}];function d(){const e=document.createElement("section");e.className="landing-section cli-carousel-section",e.id="cli";const m=l.map((t,i)=>`
    <div class="cli-item${i===0?" active":""}" data-index="${i}">
      <span class="cli-cmd">${t.cmd}</span>
      <span class="cli-desc">${t.desc}</span>
    </div>
  `).join("");e.innerHTML=`
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
            <div class="cli-carousel">
              ${m}
            </div>
            <div class="cli-highlight"></div>
          </div>
        </div>
      </div>
    </div>
  `;let s=0;const n=()=>{const t=e.getBoundingClientRect(),i=Math.max(0,Math.min(1,(window.innerHeight/2-t.top)/t.height)),a=Math.min(l.length-1,Math.floor(i*l.length));if(a!==s){s=a,e.querySelectorAll(".cli-item").forEach((o,v)=>{o.classList.toggle("active",v===s)});const r=e.querySelector(".cli-carousel");if(r){const o=-s*52;r.style.transform=`translateY(${o}px)`}}};let c=!1;const u=()=>{c||(requestAnimationFrame(()=>{n(),c=!1}),c=!0)};return window.addEventListener("scroll",u,{passive:!0}),requestAnimationFrame(n),e}var g=d();const f=Object.freeze(Object.defineProperty({__proto__:null,createCliCarousel:d,default:g},Symbol.toStringTag,{value:"Module"})),h={"block-content-components-landing-cli-carousel-org-0":{module:f,ext:"ts",isReact:!1,modeName:"dom"}};p(h);
