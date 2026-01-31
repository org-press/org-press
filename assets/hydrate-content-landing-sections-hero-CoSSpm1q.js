import{i as r}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";function i(){const e=document.createElement("section");e.className="hero-section",e.id="hero",e.innerHTML=`
    <h1 class="hero-logo">ORG-PRESS</h1>
    <div class="literate-panel">
      <div class="literate-panel-line"></div>
      <div class="literate-panel-content">
        <div class="literate-panel-inner">
          <p class="literate-panel-text">
            Literate programming weaves documentation and code into one.<br/>
            Think Markdown where the code examples actually run.<br/>
            <a href="https://en.wikipedia.org/wiki/Literate_programming" target="_blank" rel="noopener">Learn more →</a>
          </p>
        </div>
      </div>
      <div class="literate-panel-bottom">
        <span class="literate-panel-chevron">▼</span>
      </div>
    </div>
    <p class="hero-tagline">
      <span class="literate-toggle" role="button" tabindex="0">
        <span class="literate-text">Literate computing</span><span class="literate-help">?</span>
      </span> in plain text.<br/>
      Write prose and code together. Everything executes.
    </p>
    <p class="hero-license">Free software under GPLv2</p>
    <div class="hero-cta">
      <a href="./guide/getting-started.html" class="primary">Get Started</a>
      <a href="https://github.com/org-press/org-press" class="secondary">GitHub</a>
    </div>
    <div class="hero-discord">
      <a href="https://discord.gg/cSnvytw7F2" target="_blank" rel="noopener">
        <img src="/discord-icon.svg" alt="Discord" class="discord-icon" />
        <span>Help us shape the future</span>
      </a>
    </div>
    <div class="scroll-indicator">&#8595;</div>
  `;const t=e.querySelector(".literate-toggle"),s=e.querySelector(".literate-panel");return t?.addEventListener("click",()=>{s?.classList.contains("active")?(s?.classList.remove("active"),t.classList.remove("active")):(s?.classList.add("active"),t.classList.add("active"))}),t?.addEventListener("keydown",a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),t.click())}),e}var n=i();const l=Object.freeze(Object.defineProperty({__proto__:null,createHero:i,default:n},Symbol.toStringTag,{value:"Module"})),o={"block-content-landing-sections-hero-org-0":{module:l,ext:"ts",isReact:!1,modeName:"dom"}};r(o);
