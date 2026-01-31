const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/block-imports-26exARUH.js","assets/index-CErLYBU5.js","assets/_commonjsHelpers-Cpj98o6Y.js"])))=>i.map(i=>d[i]);
import{i as T}from"./hydrate-runtime-S5DTWFRe.js";import{_ as S}from"./preload-helper-BXl3LOEh.js";import{b as k}from"./wrapper-Bku-9EWA.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-CErLYBU5.js";function _(e){return`Hello, ${e}! Welcome to org block imports.`}function M(){return new Date().toLocaleString()}const C=_("Developer"),j=M(),d=document.createElement("div");d.style.cssText="padding: 1rem; background: #e3f2fd; border-radius: 8px; margin: 1rem 0;";d.innerHTML=`
  <h4 style="margin-top: 0; color: #1976d2;">Self-Import Demo</h4>
  <p>${C}</p>
  <p><small>Generated at: ${j}</small></p>
`;function $(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const L=Object.freeze(Object.defineProperty({__proto__:null,default:d,render:$},Symbol.toStringTag,{value:"Module"}));function y(e,n){return e+n}function v(e,n){return e*n}function u(e){if(e<=1)return e;let n=0,t=1;for(let o=2;o<=e;o++)[n,t]=[t,n+t];return t}const c=document.createElement("div");c.style.cssText="padding: 1rem; background: #f3e5f5; border-radius: 8px; margin: 1rem 0;";c.innerHTML=`
  <h4 style="margin-top: 0; color: #7b1fa2;">Math Utils from Library</h4>
  <ul style="margin: 0;">
    <li>add(5, 3) = ${y(5,3)}</li>
    <li>multiply(4, 7) = ${v(4,7)}</li>
    <li>fibonacci(10) = ${u(10)}</li>
  </ul>
`;function H(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c,render:H},Symbol.toStringTag,{value:"Module"}));function N(e){return e.charAt(0).toUpperCase()+e.slice(1)}function E(e){return e.toLowerCase().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}function x(e,n){return e.length<=n?e:e.slice(0,n-3)+"..."}const f=document.createElement("div");f.style.cssText="padding: 1rem; background: #e8f5e9; border-radius: 8px; margin: 1rem 0;";const z=[{input:"hello world",fn:"capitalize",output:N("hello world")},{input:"Hello World 2024!",fn:"slugify",output:E("Hello World 2024!")},{input:"This is a very long string...",fn:"truncate(20)",output:x("This is a very long string that needs truncation",20)}];f.innerHTML=`
  <h4 style="margin-top: 0; color: #388e3c;">String Utils from Library</h4>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><th>Function</th><th>Input</th><th>Output</th></tr>
    ${z.map(e=>`
      <tr>
        <td><code>${e.fn}</code></td>
        <td>${e.input}</td>
        <td><strong>${e.output}</strong></td>
      </tr>
    `).join("")}
  </table>
`;function B(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const P=Object.freeze(Object.defineProperty({__proto__:null,default:f,render:B},Symbol.toStringTag,{value:"Module"})),w=`<style>
  /* We'll inject CSS utilities from the library */
</style>
<script type="module">
  import flexUtils from './block-import-library.org?name=flex-utils';

  // Inject the imported CSS
  const style = document.createElement('style');
  style.textContent = flexUtils;
  document.head.appendChild(style);
<\/script>

<div class="flex-between" style="background: #e8f5e9; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
  <div>
    <h4 style="margin: 0; color: #388e3c;">CSS Flexbox Utils from Library</h4>
    <p style="margin: 0.5rem 0 0 0;">Using imported .flex-between and .flex-column classes</p>
  </div>
  <div class="flex-column flex-gap-2">
    <button style="padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid #4caf50; background: white; cursor: pointer;">Button 1</button>
    <button style="padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid #4caf50; background: white; cursor: pointer;">Button 2</button>
  </div>
</div>
`;function D(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const J=Object.freeze(Object.defineProperty({__proto__:null,default:w,render:D},Symbol.toStringTag,{value:"Module"})),W=`<script type="module">
  import animations from './block-import-library.org?name=animation-utils';

  const style = document.createElement('style');
  style.textContent = animations;
  document.head.appendChild(style);
<\/script>

<div class="fade-in" style="background: #fff3e0; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
  <h4 style="margin-top: 0; color: #f57c00;">Animated Content</h4>
  <p>This box uses the <code>.fade-in</code> animation imported from the library.</p>
  <div class="spin" style="display: inline-block; font-size: 2rem;">⚙️</div>
</div>
`;function R(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const F=Object.freeze(Object.defineProperty({__proto__:null,default:W,render:R},Symbol.toStringTag,{value:"Module"}));function I(e,n){const t=n.x-e.x,o=n.y-e.y;return Math.sqrt(t*t+o*o)}function U(e,n){return{x:(e.x+n.x)/2,y:(e.y+n.y)/2}}const r={x:0,y:0},a={x:3,y:4},A=I(r,a),g=U(r,a),l=document.createElement("div");l.style.cssText="padding: 1rem; background: #fff3e0; border-radius: 8px; margin: 1rem 0;";l.innerHTML=`
  <h4 style="margin-top: 0; color: #f57c00;">TypeScript Utils from Library</h4>
  <p>Point 1: (${r.x}, ${r.y})</p>
  <p>Point 2: (${a.x}, ${a.y})</p>
  <p>Distance: ${A.toFixed(2)}</p>
  <p>Midpoint: (${g.x}, ${g.y})</p>
`;function q(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const G=Object.freeze(Object.defineProperty({__proto__:null,default:l,render:q},Symbol.toStringTag,{value:"Module"})),s=document.createElement("div");s.style.cssText="padding: 1rem; background: #fce4ec; border-radius: 8px; margin: 1rem 0;";s.innerHTML=`
  <h4 style="margin-top: 0; color: #c2185b;">Import by Index Demo</h4>
  <p>Imported first block from library (index=0): <code>math-utils</code></p>
  <p>Result: add(10, 20) = ${y(10,20)}</p>
`;function K(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const V=Object.freeze(Object.defineProperty({__proto__:null,default:s,render:K},Symbol.toStringTag,{value:"Module"})),Q=`{
  "totalFiles": 3,
  "files": [
    {
      "name": "block-plugins.org",
      "size": 8882
    },
    {
      "name": "configuration.org",
      "size": 7115
    },
    {
      "name": "index.org",
      "size": 400
    }
  ]
}`,X="2026-01-31",p=document.createElement("div");p.style.cssText="padding: 1rem; background: #e0f2f1; border-radius: 8px; margin: 1rem 0;";const b=JSON.parse(Q);p.innerHTML=`
  <h4 style="margin-top: 0; color: #00796b;">Server-Side Data from Library</h4>
  <p><strong>Build Date:</strong> ${X}</p>
  <p><strong>Total org files:</strong> ${b.totalFiles}</p>
  <details>
    <summary style="cursor: pointer; color: #00796b; font-weight: bold;">File Details</summary>
    <ul>
      ${b.files.map(e=>`<li>${e.name} - ${(e.size/1024).toFixed(2)} KB</li>`).join("")}
    </ul>
  </details>
`;function Y(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const Z=Object.freeze(Object.defineProperty({__proto__:null,default:p,render:Y},Symbol.toStringTag,{value:"Module"}));function ee(e){const n=document.getElementById(e);if(!n){console.error("[JSCad] Container not found:",e);return}n.className="jscad-wrapper",n.style.cssText="position: relative; height: 400px;",n.setAttribute("data-storage-key","block-content-examples-block-imports-org-9"),S(()=>import("./block-imports-26exARUH.js"),__vite__mapDeps([0,1,2])).then(t=>{k(n,t.default)}).catch(t=>{console.error("[JSCad] Failed to load model:",t),n.innerHTML='<div style="color: red;">Error loading JSCad model: '+t.message+"</div>"})}const ne=Object.freeze(Object.defineProperty({__proto__:null,default:ee},Symbol.toStringTag,{value:"Module"}));function te(e){return{sum:e.reduce((n,t)=>n+t,0),average:e.reduce((n,t)=>n+t,0)/e.length,max:Math.max(...e),min:Math.min(...e)}}const h=Array.from({length:10},(e,n)=>u(n)),i=te(h),oe=x("Fibonacci Sequence Analysis with Mixed Imports",40),m=document.createElement("div");m.style.cssText="padding: 1rem; background: #f3e5f5; border-radius: 8px; margin: 1rem 0;";m.innerHTML=`
  <h4 style="margin-top: 0; color: #7b1fa2;">${oe}</h4>
  <p><strong>Sequence:</strong> [${h.join(", ")}]</p>
  <p><strong>Sum:</strong> ${i.sum}</p>
  <p><strong>Average:</strong> ${i.average.toFixed(2)}</p>
  <p><strong>Max:</strong> ${i.max}</p>
  <p><strong>Min:</strong> ${i.min}</p>
  <hr style="border: none; border-top: 1px solid #ddd; margin: 1rem 0;">
  <p><small>
    🔹 fibonacci() from <code>block-import-library.org</code><br>
    🔹 truncate() from <code>block-import-library.org</code><br>
    🔹 processData() from <code>block-imports.org</code> (this file)
  </small></p>
`;function ie(e,n){e!=null&&(typeof e=="function"?e(n.id):e instanceof HTMLElement?n.hasChildNodes()||n.appendChild(e):typeof e=="string"?e.trim().startsWith("<")?n.innerHTML=e:n.textContent=e:typeof e=="number"||typeof e=="boolean"?n.textContent=String(e):typeof e=="object"&&(n.innerHTML="<pre>"+JSON.stringify(e,null,2)+"</pre>"))}const re=Object.freeze(Object.defineProperty({__proto__:null,default:m,render:ie},Symbol.toStringTag,{value:"Module"})),ae={"block-content-examples-block-imports-org-1":{module:L,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-2":{module:O,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-3":{module:P,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-4":{module:J,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-5":{module:F,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-6":{module:G,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-7":{module:V,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-8":{module:Z,ext:"js",isReact:!1,modeName:"dom"},"block-content-examples-block-imports-org-9":{module:ne,ext:"js",isReact:!1,modeName:"jscad"},"block-content-examples-block-imports-org-11":{module:re,ext:"js",isReact:!1,modeName:"dom"}};T(ae);
