import{S as kt,C as xe,P as Ct,W as At,a as Et,M as Ht,I as Lt,b as Tt,g as It,c as Rt,d as Dt,f as Pt,h as Yt,e as Ft,r as qt,V as Wt}from"./formations.org_NAME_formations-BY65bvBS.js";import{e as Se,a as Gt,s as Qe,t as Xt}from"./animation.org_NAME_animation-CWcJ1bJ7.js";function Ut(t,o={}){const{gridCols:a=40,gridRows:s=30,sphereRadius:u=.3,spacing:f=1.2,backgroundColor:R=657935,sphereColor:H=16777215}=o,S=new kt;S.background=new xe(R);const m=new Ct(50,1,.1,1e3),q=50;m.position.set(0,0,q),m.lookAt(0,0,0);const x=new At({antialias:!0});x.setPixelRatio(Math.min(window.devicePixelRatio,2)),t.appendChild(x.domElement),x.domElement.style.position="fixed",x.domElement.style.top="0",x.domElement.style.left="0",x.domElement.style.width="100vw",x.domElement.style.height="100vh",x.domElement.style.zIndex="0",x.domElement.style.pointerEvents="none";const ie=new Et(u,8,6),oe=new Ht({color:H}),se=a*s,L=new Lt(ie,oe,se),V=new xe(H),j=new Float32Array(se*3);for(let i=0;i<se;i++)j[i*3]=V.r,j[i*3+1]=V.g,j[i*3+2]=V.b;L.instanceColor=new Tt(j,3),S.add(L);const k=2*Math.tan(50/2*Math.PI/180)*q,ke=window.innerWidth/window.innerHeight,U=k*ke,J=Math.max(U/a,k/s)*1.1,ue=(a-1)*J,C=(s-1)*J,ce={gridCols:a,gridRows:s,effectiveSpacing:J,gridWidth:ue,gridHeight:C,visibleWidth:U,visibleHeight:k,totalSpheres:se},{sphereToCube:ve,cubeStates:l,spheresPerCubeSide:re,sphereSpacingInCube:Q}=It(ce),{sphereToGlobe:ne,globeRadius:me}=Rt(ce),{sphereToPrism:Ce}=Dt(ce),{warpStars:fe,warpTunnelRadius:Ae,warpDepth:Y,warpNearPlane:N}=Ft(ce),X=[],h=[],v=new Pt;let _=0;for(let i=0;i<s;i++)for(let b=0;b<a;b++){const w=b*J-ue/2,F=i*J-C/2,D=Math.sqrt(Math.pow(b-a/2,2)+Math.pow(i-s/2,2)),B=Math.sqrt(Math.pow(a/2,2)+Math.pow(s/2,2)),he=D/B*1.5;h.push({targetX:w,targetY:F,targetZ:0,targetScale:.15,currentX:w,currentY:F-k*1.5,currentZ:0,currentScale:.15,delay:he,isCharacter:!1,wordGroup:-1,baseZ:0,baseScale:.15,highlightAmount:0,targetHighlight:0,highlightDelay:Math.random()}),v.makeTranslation(w,F-k*1.5,0),L.setMatrixAt(_,v),_++}L.instanceMatrix.needsUpdate=!0;let W=0,K=0,De=0,Pe=0;const Ye=.05,Fe=.15,qe=i=>{De=i.clientX/window.innerWidth*2-1,Pe=i.clientY/window.innerHeight*2-1};window.addEventListener("mousemove",qe,{passive:!0});const Ee=()=>{const i=window.innerWidth,b=window.innerHeight;m.aspect=i/b,m.updateProjectionMatrix(),x.setSize(i,b)};window.addEventListener("resize",Ee),Ee();let Z="grid",ee=0,He=0;const le=[];let We=0;const et=2500,tt=3;let Ge=0;const st=8e-4;let Le=0;const nt=5e-4;let de=0,Xe=0;const at=1500,it=1200,ot=800,ct=1200,rt=.4,lt=5,dt=1.6,ht=.35,pt=3,gt=new xe(H).multiplyScalar(ht),ze=new xe;let Ze=0;const ut=800;let Te=null,Ie=null;const mt=2;function Be(i){Te=requestAnimationFrame(Be),Ie===null&&(Ie=i);const b=(i-Ie)/1e3;if(W+=(De-W)*Ye,K+=(Pe-K)*Ye,ee+=(He-ee)*.04,Z==="pipeline"){i-We>et&&le.length<tt&&(We=i,le.push({x:(Math.random()-.5)*U*.8,y:(Math.random()-.5)*k*.8,radius:0,maxRadius:Math.max(U,k)*.6,strength:1,speed:.03+Math.random()*.02}));for(let n=le.length-1;n>=0;n--){const e=le[n];e.radius+=e.speed,e.strength=1-e.radius/e.maxRadius,e.radius>e.maxRadius&&le.splice(n,1)}}if(Z==="globe"&&(Ge+=st),Z==="prism"&&(Le+=nt),Z==="warp"){de=Math.min(de+5e-4,.15);const n=.008+de*.06;for(const e of fe){e.z+=n*e.speedMultiplier;const p=(e.z+Y*.5)/Y;e.stretch=1+p*de*2,e.brightness=.4+p*.6,e.z>N&&qt(e,Ae,Y)}}else de=Math.max(0,de-.01);if(ee<.5){const n=X.filter(e=>e.isHighlighted).length;if(i-Xe>at&&X.length>0&&n<pt){Xe=i;const e=X.filter(p=>!p.isHighlighted);if(e.length>0){const p=Math.floor(Math.random()*e.length),r=e[p];r.isHighlighted=!0,r.highlightStartTime=i,r.highlightDuration=(it+ot+ct)*(1+(Math.random()-.5)*2*rt)}}for(const e of X){if(!e.isHighlighted)continue;const p=i-e.highlightStartTime,r=e.highlightDuration,ae=r*.35,c=r*.25,A=r*.15;if(p>r+A+300){e.isHighlighted=!1;for(const E of e.sphereIndices)h[E].targetHighlight=0;continue}for(const E of e.sphereIndices){const g=h[E],T=g.highlightDelay*A,G=p-T;G<0?g.targetHighlight=0:G<ae+c?g.targetHighlight=1:g.targetHighlight=0}}}else for(const n of X){n.isHighlighted=!1;for(const e of n.sphereIndices)h[e].targetHighlight=0}if(ee>.5){const n=l.filter(e=>e.isHighlighted).length;if(i-Ze>ut&&n<1){Ze=i;const e=l.map((p,r)=>({state:p,idx:r})).filter(p=>!p.state.isHighlighted);if(e.length>0){const p=Math.floor(Math.random()*e.length),r=e[p];r.state.isHighlighted=!0,r.state.highlightStartTime=i,r.state.highlightDuration=4e3+Math.random()*2e3}}for(const e of l)e.isHighlighted&&i-e.highlightStartTime>e.highlightDuration&&(e.isHighlighted=!1)}let F=!1;const D=1.2,B=8,he=.6;h.forEach((n,e)=>{const p=Math.max(0,b-n.delay),r=Math.min(1,p/mt),ae=Gt(r),c=ve[e],A=c&&c.isInCube?l[c.cubeIdx]:null;let E=0;if(A&&A.isHighlighted){const d=i-A.highlightStartTime,M=A.highlightDuration/2;d<M?E=Se(d/M):E=Se(1-(d-M)/M)}const g=n.targetX,T=n.targetY,G=n.baseZ,z=n.baseScale;let y=g,P=T,I=0,O=z;if(Z==="cube")c&&c.isInCube&&(y=c.cubeCenterX+(c.localX-(re-1)/2)*Q,P=c.cubeCenterY+(c.localY-(re-1)/2)*Q,I=(c.localZ-(re-1)/2)*Q+E*B),O=D*(1+E*he);else if(Z==="pipeline"){y=g,P=T,I=0,O=1;let d=0;for(const M of le){const te=g-M.x,je=T-M.y,xt=Math.sqrt(te*te+je*je),Ue=2.5,Je=Math.abs(xt-M.radius);if(Je<Ue){const St=(1-Je/Ue)*M.strength;d=Math.max(d,St)}}I=d*4,O=1+d*.5}else if(Z==="globe"){const d=ne[e];if(d&&d.isOnGlobe){const M=d.theta+Ge;y=me*Math.sin(d.phi)*Math.cos(M),P=me*Math.cos(d.phi),I=me*Math.sin(d.phi)*Math.sin(M),O=1}else y=g,P=T,I=-50,O=.01}else if(Z==="prism"){const d=Ce[e];if(d&&d.isOnPrism){const M=Math.cos(Le),te=Math.sin(Le);y=d.x*M-d.z*te,P=d.y,I=d.x*te+d.z*M,O=1.2}else y=g,P=T,I=-50,O=.01}else if(Z==="warp"){const d=fe[e];if(d&&d.isActive){const M=(d.z+Y*.5)/Y,te=.3+M*1.5;y=d.baseX*te,P=d.baseY*te,I=d.z,O=.6+M*1,L.setColorAt(e,V),F=!0}else y=0,P=0,I=-100,O=0}const $=Se(ee),vt=g*(1-$)+y*$,Oe=T*(1-$)+P*$,ft=z*(1-$)+O*$,$e=n.highlightAmount*(1-$),Ne=Se($e),bt=G*(1-$)+I*$+Ne*lt,wt=ft*(1+Ne*(dt-1));n.highlightAmount+=(n.targetHighlight-n.highlightAmount)*.12;const _e=n.targetY-k*1.5,yt=_e+(Oe-_e)*ae,Mt=ee<.1?yt:Oe,Me=.08;n.currentX+=(vt-n.currentX)*Me,n.currentY+=(Mt-n.currentY)*Me,n.currentZ+=(bt-n.currentZ)*Me,n.currentScale+=(wt-n.currentScale)*Me;const Ve=Math.max($e,E*$);Ve>.01?(ze.copy(V).lerp(gt,Ve),L.setColorAt(e,ze),F=!0):n.highlightAmount<.01&&E<.01&&(L.setColorAt(e,V),F=!0),v.makeTranslation(n.currentX,n.currentY,n.currentZ),v.scale(new Wt(n.currentScale,n.currentScale,n.currentScale)),L.setMatrixAt(e,v)}),L.instanceMatrix.needsUpdate=!0,F&&L.instanceColor&&(L.instanceColor.needsUpdate=!0);const pe=-K*Fe,ge=-W*Fe,be=q*Math.sin(ge)*Math.cos(pe),we=q*Math.sin(pe),ye=q*Math.cos(ge)*Math.cos(pe);m.position.set(be,we,ye),m.lookAt(0,0,0),x.render(S,m)}return requestAnimationFrame(Be),{canvas:x.domElement,setFormation:(i,b=!1)=>{Z=i,He=i==="grid"?0:1,b&&(ee=He)},getFormationProgress:()=>ee,setPattern:i=>{for(let b=0;b<s;b++)for(let w=0;w<a;w++){const F=b*a+w,D=i[s-1-b]?.[w]??!1,B=h[F];B&&(B.targetScale=D?1:.15,B.targetZ=D?2:0,B.isCharacter=D)}},setText:i=>{const b=Yt(),w=5,F=7,D=1,B=8,he=["ORG","PRESS"],pe="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),ge=Array(s).fill(null).map(()=>Array(a).fill(!1)),be=Array(s).fill(null).map(()=>Array(a).fill(-1));X.length=0;let we=0;for(let p=0;p<s;p+=B){let r=0;for(;r<a;)if(Math.random()<.2){const c=he[Math.floor(Math.random()*he.length)],A=c.length*(w+D)-D;if(r+A>a)break;const E={word:c,sphereIndices:[],isHighlighted:!1,highlightStartTime:0,highlightDuration:0};let g=r;for(const T of c){const G=b[T.toUpperCase()];if(!G){g+=w+D;continue}for(let z=0;z<F;z++)for(let y=0;y<w;y++)if(G[z]?.[y]){const P=p+z,I=g+y;P>=0&&P<s&&I>=0&&I<a&&(ge[P][I]=!0,be[P][I]=we)}g+=w+D}X.push(E),we++,r+=A+2}else{const c=2+Math.floor(Math.random()*4);for(let A=0;A<c&&!(r+w>a);A++){const E=pe[Math.floor(Math.random()*pe.length)],g=b[E];if(!g){r+=w+D;continue}for(let T=0;T<F;T++)for(let G=0;G<w;G++)if(g[T]?.[G]){const z=p+T,y=r+G;z>=0&&z<s&&y>=0&&y<a&&(ge[z][y]=!0)}r+=w+D}}}const ye=.8,n=0,e=.15;for(let p=0;p<s;p++)for(let r=0;r<a;r++){const ae=p*a+r,c=h[ae];if(!c)continue;const A=s-1-p,E=ge[A]?.[r]??!1,g=be[A]?.[r]??-1;E?(c.targetScale=ye,c.baseScale=ye,c.targetZ=n,c.baseZ=n,c.isCharacter=!0,c.wordGroup=g,c.highlightDelay=Math.random(),g>=0&&g<X.length&&X[g].sphereIndices.push(ae)):(c.targetScale=e,c.baseScale=e,c.targetZ=0,c.baseZ=0,c.isCharacter=!1,c.wordGroup=-1)}},dispose:()=>{Te&&cancelAnimationFrame(Te),window.removeEventListener("mousemove",qe),window.removeEventListener("resize",Ee),x.dispose(),ie.dispose(),oe.dispose()}}}function Jt(t){const o=document.createElement("canvas"),a=o.getContext("2d");o.style.position="fixed",o.style.top="0",o.style.left="0",o.style.width="100vw",o.style.height="100vh",o.style.zIndex="0",o.style.pointerEvents="none",t.appendChild(o);const s=60,u=100,f=1.2,R=window.matchMedia("(prefers-color-scheme: dark)").matches,H=R?"#0a0a0f":"#f5f5f7",S=R?[153,153,153]:[119,119,119];let m=0,q=0,x=0,ie=0;const oe=[],se=Array.from({length:6},()=>({x:.2+Math.random()*.6,y:.2+Math.random()*.6,vx:(Math.random()-.5)*3e-4,vy:(Math.random()-.5)*3e-4,radius:.08+Math.random()*.06,phase:Math.random()*Math.PI*2}));function L(){m=window.innerWidth,q=window.innerHeight;const C=Math.min(window.devicePixelRatio,2);o.width=m*C,o.height=q*C,a.setTransform(C,0,0,C,0,0),x=m/s,ie=q/u,V()}function V(){oe.length=0;for(let C=0;C<u*s;C++)oe.push({brightness:.1,scale:1,delay:Math.random()})}let j="grid",k=0;function ke(C){C!==j&&(j=C)}let U,J=0;function ue(C){const ce=Math.min(C-J,50);J=C,k+=ce,a.fillStyle=H,a.fillRect(0,0,m,q);for(const l of se)l.x+=l.vx,l.y+=l.vy,(l.x<.1||l.x>.9)&&(l.vx*=-1),(l.y<.1||l.y>.9)&&(l.vy*=-1),l.vx+=(Math.random()-.5)*5e-5,l.vy+=(Math.random()-.5)*5e-5,l.vx=Math.max(-5e-4,Math.min(5e-4,l.vx)),l.vy=Math.max(-5e-4,Math.min(5e-4,l.vy));const ve=.05;oe.forEach((l,re)=>{const Q=re%s,ne=Math.floor(re/s),me=Q*x+x/2,Ce=ne*ie+ie/2,fe=Q/s,Ae=ne/u;let Y=.1,N=1;switch(j){case"grid":{const h=Math.sin(k*.0015+l.delay*50)*.5+.5;Y=h>.93?.5+h*.3:.08,N=h>.93?1.3:1;break}case"cube":{let h=0;for(const v of se){const _=v.radius*(1+Math.sin(k*.001+v.phase)*.2),W=Math.sqrt((fe-v.x)**2+(Ae-v.y)**2);if(W<_){const K=(1-W/_)**2;h=Math.max(h,K)}}Y=.06+h*.6,N=.9+h*.6;break}case"pipeline":{const h=Math.sin(k*.002-ne*.15)*.5+.5;Y=.1+h*.5,N=.8+h*.5;break}case"globe":{const h=(Q-s/2)/(s/2),v=(ne-u/2)/(u/2),_=Math.sqrt(h*h+v*v),W=Math.sin(_*8-k*.0015)*.5+.5;Y=.1+W*.5,N=.8+W*.4;break}case"prism":{const h=Math.sin(k*.0025+l.delay*20)*.5+.5,v=h>.85?1:h*.4;Y=.1+v*.6,N=.8+v*.6;break}case"warp":{const h=Q-s/2,v=ne-u/2,_=Math.atan2(v,h),W=Math.sin(_*12+k*.004)*.5+.5,K=Math.sqrt(h*h+v*v)/Math.sqrt(s*s+u*u);Y=W*(.2+K*.5),N=.6+W*K;break}}l.brightness+=(Y-l.brightness)*ve,l.scale+=(N-l.scale)*ve;const X=f*l.scale;a.beginPath(),a.arc(me,Ce,X,0,Math.PI*2),a.fillStyle=`rgba(${S[0]},${S[1]},${S[2]},${l.brightness})`,a.fill()}),U=requestAnimationFrame(ue)}return L(),window.addEventListener("resize",L),U=requestAnimationFrame(ue),{canvas:o,setFormation:ke,dispose(){cancelAnimationFrame(U),window.removeEventListener("resize",L),o.remove()}}}function zt(){const t=document.createElement("section");t.className="hero-section",t.id="hero",t.innerHTML=`
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
  `;const o=t.querySelector(".literate-toggle"),a=t.querySelector(".literate-panel");return o?.addEventListener("click",()=>{a?.classList.contains("active")?(a?.classList.remove("active"),o.classList.remove("active")):(a?.classList.add("active"),o.classList.add("active"))}),o?.addEventListener("keydown",s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),o.click())}),t}zt();function Zt(){const t=document.createElement("section");t.className="landing-section code-preview-section",t.id="code-blocks";let o=0;const a=["#ff6b6b","#4ecdc4","#ffe66d","#95e1d3"];return t.innerHTML=`
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
  `,requestAnimationFrame(()=>{const s=t.querySelector("#counter-trigger");s&&s.addEventListener("click",()=>{o++,s.textContent=`Clicked ${o} times`,s.style.background=a[o%a.length]}),t.querySelectorAll(".code-tab").forEach(f=>{f.addEventListener("click",()=>{const R=f.getAttribute("data-tab"),H=f.closest(".code-tabs-container");if(!H||!R)return;H.querySelectorAll(".code-tab").forEach(m=>m.classList.remove("active")),f.classList.add("active"),H.querySelectorAll(".code-tab-content").forEach(m=>m.classList.remove("active"));const S=H.querySelector(`[data-content="${R}"]`);S&&S.classList.add("active")})})}),t}Zt();function Bt(){const t=document.createElement("section");return t.className="landing-section terminal-demo-section",t.id="ssg",t.innerHTML=`
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
              <span class="terminal-command">orgp dev</span>
            </div>
            <div class="terminal-output">
              <div class="output-line visible">Ready in 127ms</div>
              <div class="output-line visible"><span class="dim">Local:</span>   <span class="url-link">http://localhost:3000/</span></div>
              <div class="output-line visible"><span class="dim">press</span> <span class="key">h + enter</span> <span class="dim">to show help</span></div>
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
  `,t}Bt();function Ot(){const t=document.createElement("section");return t.className="landing-section community-section",t.id="community",t.innerHTML=`
    <div class="section-content">
      <span class="section-label">Extensible Platform</span>
      <h2>Build Your Community</h2>
      <p>
        With custom themes and the <code>:use</code> directive for block plugins,
        org-press becomes a foundation for specialized communities.
        Create and share domain-specific toolkits.
      </p>

      <div class="community-grid">
        <div class="community-card components">
          <span class="card-icon">&#9645;</span>
          <h3>Component Libraries</h3>
          <p>Build and document React, Vue, or Web Components with live previews and interactive examples.</p>
        </div>

        <div class="community-card design">
          <span class="card-icon">&#9670;</span>
          <h3>Design Systems</h3>
          <p>Create living style guides with tokens, patterns, and design elements that execute and render.</p>
        </div>

        <div class="community-card diagrams">
          <span class="card-icon">&#9633;</span>
          <h3>Architecture Docs</h3>
          <p>Technical diagrams with Excalidraw, Mermaid, or PlantUML. Living documentation that stays in sync.</p>
        </div>

        <div class="community-card printing">
          <span class="card-icon">&#9649;</span>
          <h3>3D Printing</h3>
          <p>Parametric models with JSCAD. Document, customize, and export STL files directly from org blocks.</p>
        </div>

        <div class="community-card data">
          <span class="card-icon">&#9651;</span>
          <h3>Data Science</h3>
          <p>Literate notebooks with D3, Observable Plot, or custom visualizations. Reproducible analysis.</p>
        </div>

        <div class="community-card music">
          <span class="card-icon">&#9835;</span>
          <h3>Live Coding Music</h3>
          <p>Integrate Strudel, Tone.js, or other audio libraries. Compose and perform with executable scores.</p>
        </div>

        <div class="community-card ai">
          <span class="card-icon">&#10022;</span>
          <h3>AI Prompt Engineering</h3>
          <p>Compose, version, and test prompts. Build reusable prompt libraries with structured context.</p>
        </div>

        <div class="community-card">
          <span class="card-icon">&#43;</span>
          <h3>Your Domain</h3>
          <p>Create custom block handlers for any use case. The <code>:use</code> system makes anything possible.</p>
        </div>
      </div>
    </div>
  `,t}Ot();const Re=[{cmd:"fmt",desc:"Format org files and code blocks"},{cmd:"lint",desc:"Check for style and syntax issues"},{cmd:"test",desc:"Run tests from code blocks"},{cmd:"type-check",desc:"TypeScript type validation"},{cmd:"build",desc:"Build for production"}];function $t(){const t=document.createElement("section");t.className="landing-section cli-carousel-section",t.id="cli",t.innerHTML=`
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
              ${Re.map((u,f)=>`
                <div class="cli-item${f===0?" active":""}" data-index="${f}">
                  <span class="cli-cmd">${u.cmd}</span>
                  <span class="cli-desc">${u.desc}</span>
                </div>
              `).join("")}
            </div>
            <div class="cli-highlight"></div>
          </div>
        </div>
      </div>
    </div>
  `;let o=0;function a(){const u=t.getBoundingClientRect(),f=Math.max(0,Math.min(1,(window.innerHeight/2-u.top)/u.height)),R=Math.min(Re.length-1,Math.floor(f*Re.length));if(R!==o){o=R,t.querySelectorAll(".cli-item").forEach((m,q)=>{m.classList.toggle("active",q===o)});const S=t.querySelector("#cli-carousel");if(S){const m=-o*52;S.style.transform=`translateY(${m}px)`}}}let s=!1;return window.addEventListener("scroll",()=>{s||(requestAnimationFrame(()=>{a(),s=!1}),s=!0)},{passive:!0}),t}$t();const Ke=[{type:"error",content:"Block renders nothing - output is empty",delay:0},{type:"ai",content:"Your block is missing `export function render()`. With `:use dom`, you need to export a render function that returns the rendered output.",delay:800},{type:"user",content:"Yes, add it",delay:1600},{type:"success",content:"Added `export function render() { return <Card>{data}</Card>; }` - now rendering!",delay:2200}];function Nt(){const t=document.createElement("section");t.className="landing-section ai-chat-section",t.id="ai",t.innerHTML=`
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
  `;let o=!1;async function a(){const u=t.querySelectorAll(".chat-message");for(let f=0;f<Ke.length;f++){const R=Ke[f],H=u[f],S=H?.querySelector(".message-text");!H||!S||(await Qe(R.delay),H.classList.add("visible"),await Xt(S,R.content,R.type==="user"?40:20),await Qe(300))}}const s=new IntersectionObserver(u=>{for(const f of u)f.isIntersecting&&!o&&(o=!0,a(),s.disconnect())},{threshold:.3});return requestAnimationFrame(()=>{s.observe(t)}),t}Nt();function _t(){const t=document.createElement("section");return t.className="links-section",t.innerHTML=`
    <h2 class="links-section-title">Get Started</h2>
    <div class="links-grid">
      <a href="./guide/getting-started.html" class="link-card">
        <span class="link-card-icon">&#9889;</span>
        <div class="link-card-content">
          <h3>Quick Start <span class="link-card-arrow">&#8594;</span></h3>
          <p>Create your first org-press project in minutes</p>
        </div>
      </a>
      <a href="./guide/features.html" class="link-card">
        <span class="link-card-icon">&#10024;</span>
        <div class="link-card-content">
          <h3>Features <span class="link-card-arrow">&#8594;</span></h3>
          <p>Interactive code blocks, live preview, and more</p>
        </div>
      </a>
      <a href="./guide/block-imports.html" class="link-card">
        <span class="link-card-icon">&#128279;</span>
        <div class="link-card-content">
          <h3>Block Imports <span class="link-card-arrow">&#8594;</span></h3>
          <p>Share and reuse code across your documentation</p>
        </div>
      </a>
      <a href="./plugins/index.html" class="link-card">
        <span class="link-card-icon">&#128640;</span>
        <div class="link-card-content">
          <h3>Plugins <span class="link-card-arrow">&#8594;</span></h3>
          <p>Extend with Excalidraw, JSCAD, and more</p>
        </div>
      </a>
    </div>
  `,t}_t();export{Zt as a,Bt as b,zt as c,Ot as d,$t as e,Nt as f,_t as g,Jt as h,Ut as i};
