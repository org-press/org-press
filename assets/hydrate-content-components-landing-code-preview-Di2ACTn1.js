import{i as M}from"./hydrate-runtime-S5DTWFRe.js";import"./preload-helper-BXl3LOEh.js";function w(t,n){const a=["#ff6b6b","#4ecdc4","#45b7d1","#96ceb4","#ffeaa7","#dfe6e9","#fd79a8"];for(let c=0;c<80;c++){let i=function(){const f=performance.now()-k;if(f>2e3||s<=0){e.remove();return}u+=x,d+=y,p+=u,m+=g/60,s=Math.max(0,1-f/2e3),e.style.transform=`translate(${d}px, ${p}px) rotate(${m}deg)`,e.style.opacity=String(s),requestAnimationFrame(i)};const e=document.createElement("div");e.className="confetti-particle";const b=a[Math.floor(Math.random()*a.length)],r=6+Math.random()*6,v=(Math.random()*120-60)*(Math.PI/180),l=8+Math.random()*8,g=(Math.random()-.5)*720;e.style.cssText=`
      position: fixed;
      width: ${r}px;
      height: ${r*.6}px;
      background: ${b};
      left: ${t}px;
      top: ${n}px;
      pointer-events: none;
      z-index: 9999;
      border-radius: 2px;
    `,document.body.appendChild(e);let d=0,p=0,u=-l*Math.sin(Math.PI/3+v*.5),y=l*Math.cos(Math.PI/3)*(Math.random()>.5?1:-1)*(.5+Math.random()),m=0,s=1;const x=.3,k=performance.now();requestAnimationFrame(i)}}function h(){const t=document.createElement("section");t.className="landing-section code-preview-section",t.id="code-blocks",t.innerHTML=`
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
          <button class="confetti-btn" type="button">
            Click Me!
          </button>
        </div>
      </div>
      <div class="section-visual">
        <div class="code-block-preview">
          <div class="code-header">
            <span class="code-lang">tsx</span>
          </div>
          <pre class="code-content"><code><span class="code-keyword">#+begin_src</span> <span class="code-type">tsx</span> <span class="code-attr">:use dom</span>
<span class="code-keyword">const</span> <span class="code-var">ConfettiBtn</span> = () => (
  <span class="code-tag">&lt;button</span> <span class="code-attr">onClick</span>={<span class="code-var">fireConfetti</span>}<span class="code-tag">&gt;</span>
    Click Me!
  <span class="code-tag">&lt;/button&gt;</span>
);

<span class="code-keyword">export function</span> <span class="code-var">render</span>() { return <span class="code-tag">&lt;ConfettiBtn /&gt;</span>; }
<span class="code-keyword">#+end_src</span></code></pre>
        </div>
      </div>
    </div>
  `;const n=t.querySelector(".confetti-btn");return n&&n.addEventListener("click",a=>{const o=n.getBoundingClientRect();w(o.left+o.width/2,o.top+o.height/2)}),t}var C=h();const S=Object.freeze(Object.defineProperty({__proto__:null,createCodePreview:h,default:C},Symbol.toStringTag,{value:"Module"})),_={"block-content-components-landing-code-preview-org-0":{module:S,ext:"ts",isReact:!1,modeName:"dom"}};M(_);
