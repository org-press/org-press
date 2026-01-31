const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/client-BnCK6Ljt.js","assets/_commonjsHelpers-Cpj98o6Y.js","assets/index-DCsVGpXX.js","assets/index-jiGZ2avh.js"])))=>i.map(i=>d[i]);
import{_ as l}from"./preload-helper-BXl3LOEh.js";const h={react:"@org-press/react",vue:"@org-press/vue",rust:"@org-press/rust"};function E(e){return e.charAt(0).toUpperCase()+e.slice(1)}function u(e,r){const o=h[r],t=E(r);return`
    <div class="org-press-error" style="
      padding: 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 0.5rem;
      color: #991b1b;
      font-family: system-ui, sans-serif;
    ">
      <strong>Block not rendered</strong>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem;">
        This block requires <code>${o}</code>. Add it to your config:
      </p>
      <pre style="
        margin: 0.5rem 0 0 0;
        padding: 0.5rem;
        background: #fee2e2;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        overflow-x: auto;
      ">import { use${t} } from '${o}';

export default defineConfig({
  modes: [use${t}()]
});</pre>
    </div>
  `.trim()}function m(e,r){const o=h[r]||`@org-press/${r}`,t=E(r);console.warn(`[org-press] Block "${e.blockId}" in ${e.orgFilePath} was not rendered.
  → This ${e.language} block requires ${o}.
  → Install it and add to your config: modes: [use${t}()]`)}const k=Symbol.for("react.element"),_=Symbol.for("react.transitional.element");function g(e){if(e===null||typeof e!="object")return!1;const r=e;return r.$$typeof===k||r.$$typeof===_}function p(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function $(e){return e==null?"":typeof e=="string"?e.trim().startsWith("<")?e:p(e):typeof e=="number"||typeof e=="boolean"?String(e):typeof e=="object"?`<pre>${p(JSON.stringify(e,null,2))}</pre>`:p(String(e))}function w(e,r){if(r!=null){if(typeof r=="function"){r(e.id);return}if(r instanceof HTMLElement){e.hasChildNodes()||e.appendChild(r);return}if(r instanceof DocumentFragment){e.appendChild(r);return}if(typeof r=="string"){r.trim().startsWith("<")?e.innerHTML=r:e.textContent=r;return}if(typeof r=="number"||typeof r=="boolean"){e.textContent=String(r);return}if(typeof r=="object"){e.innerHTML=`<pre>${JSON.stringify(r,null,2)}</pre>`;return}e.textContent=String(r)}}const S={name:"dom",onServerRender(e,r){return g(e)?u(r,"react"):r.render?"":$(e)},onClientHydrate(e,r,o){if(g(e)){o.innerHTML=u(r,"react"),console.error(`[org-press] Block "${r.blockId}" returns a React element but @org-press/react is not installed. Add it to your config:

  import { useReact } from '@org-press/react';
  export default defineConfig({ modes: [useReact()] });`);return}if(r.render){const t=r.render(e,o);t instanceof HTMLElement?o.appendChild(t):typeof t=="string"&&(t.trim().startsWith("<")?o.innerHTML=t:o.textContent=t);return}w(o,e)},canHandle(e){return!g(e)}},f=new Map;f.set("dom",S);function M(e){if(e===null||typeof e!="object")return!1;const r=e;return r.$$typeof===Symbol.for("react.element")||r.$$typeof===Symbol.for("react.transitional.element")}function R(e,r,o){const t=f.get("dom");if(!t)throw new Error("[org-press] DOM mode is not registered. This is a bug in org-press.");if(e!=="dom"){const i=f.get(e);return i||(m(o,e),t)}return M(r)&&!f.has("react")&&m(o,"react"),t}const y=new Map;async function T(e,r,o){const[t,i]=await Promise.all([l(()=>import("./client-BnCK6Ljt.js").then(a=>a.c),__vite__mapDeps([0,1,2])),l(()=>import("./index-jiGZ2avh.js").then(a=>a.$),__vite__mapDeps([3,1,2]))]);let n=y.get(e);n||(n=t.createRoot(e),y.set(e,n)),n.render(i.createElement(r,{result:o}))}async function C(e,r){const o=e.id,t=e.dataset.orgBlock||o;r.language==="tsx"||r.language;try{e.dataset.hydrating="true";const i=await import(r.src);let n=i.default;n&&typeof n.then=="function"&&(n=await n),delete e.dataset.hydrating,e.dataset.hydrated="true";const a=i.render,c=r.modeName||"dom";if(c==="react"&&a){await T(e,a,n);return}const s={blockId:t,code:"",language:r.language||"",params:{},render:a,orgFilePath:"",blockIndex:0,containerId:o};await R(c,n,{blockId:t,language:r.language||"",orgFilePath:""}).onClientHydrate(n,s,e)}catch(i){console.error(`[org-press] Failed to hydrate block ${o}:`,i),e.dataset.hydrated="error",e.dataset.hydrateError=i instanceof Error?i.message:String(i)}}function b(e,r={}){const{lazy:o=!0,rootMargin:t="100px"}=r,i=e||window.__ORG_PRESS_MANIFEST__||{},n=document.querySelectorAll("[data-org-block]");if(n.length===0)return;const a=c=>{const s=c.dataset.orgBlock;if(!s)return;const d=i[s];if(!d){console.warn(`[org-press] No manifest entry for block ${s}`);return}C(c,d)};if(o&&"IntersectionObserver"in window){const c=new IntersectionObserver(s=>{s.forEach(d=>{d.isIntersecting&&(c.unobserve(d.target),a(d.target))})},{rootMargin:t});n.forEach(s=>c.observe(s))}else n.forEach(a)}typeof window<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>b()):b());export{b as hydrate};
