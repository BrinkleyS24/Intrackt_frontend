const a=document.getElementById("root"),e=chrome.runtime.getURL("popup/public/index.html"),t={build:null,testing:null,snapshot:null,scenarios:[],busyAction:null,frameKey:Date.now(),renderSignature:null};async function s(a){return chrome.runtime.sendMessage(a)}function i(){return`${e}?lab=1&frame=${t.frameKey}`}function l(a){return String(a||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function n(a){if(!a)return"Unavailable";let e=new Date(a);return Number.isNaN(e.getTime())?"Unavailable":e.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}function r(){if(!a)return;let e=i(),o=a.querySelector('[data-testid="popup-preview-frame"]'),d=o&&o.getAttribute("src")===e?o:null,p=t.testing||{supported:!1,active:!1},u=(t.build||{}).runtime||{},b=t.snapshot||null,v=p.scenarioId||null,m=t.scenarios.find(a=>a.id===v)||null,h=b?.categoryTotals||{},g=b?.auth?.isLoggedIn?"Signed in":"Signed out",y=b?.auth?.email||"Unavailable",f=b?.auth?.isLoggedIn?"premium"===b?.userPlan?"Premium":"Free":"N/A",w=function(a){if(!a?.auth?.isLoggedIn)return"Signed out";let e=a?.quota||null;if(!e)return"Unavailable";let t=function(a){let e=a?.quota||null;return e?Number.isFinite(e.trackedApplications)?e.trackedApplications:Number.isFinite(e.usage)?e.usage:Number.isFinite(a?.trackedApplications)?a.trackedApplications:Number(e.totalProcessed||0):Number(a?.trackedApplications||0)}(a);if(a?.userPlan==="premium")return`${t} tracked - Unlimited`;let s=Number(e.limit||100);return e.limitReached||t>=s?`${t}/${s} tracked - Limit reached`:`${t}/${s} tracked`}(b),A=function(a){let e=a?.sync||null;if(!a?.auth?.isLoggedIn)return"Signed out";if(!e?.inProgress){let a=e?.lastCompletedAt||e?.lastSyncAt;return a?`Idle - last ${n(a)}`:"Idle"}let t=e?.startedAt||e?.lastSyncAt;return t?`In progress - started ${n(t)}`:"In progress"}(b),$=Number(h.relevant||0),S=["applied","interviewed","offers","rejected","irrelevant"].map(a=>`
      <span class="lab-chip" data-testid="state-count-${l(a)}">
        ${l(a)}: ${l(h[a]??0)}
      </span>
    `).join(""),E=JSON.stringify({popupUrl:e,busyAction:t.busyAction,testing:p,snapshot:b,scenarios:t.scenarios,runtime:{backendBaseUrl:u.backendBaseUrl||null,premiumDashboardUrl:u.premiumDashboardUrl||null}});if(t.renderSignature===E)return;t.renderSignature=E;let k=t.scenarios.map(a=>{let e=v===a.id;return`
      <button
        class="lab-scenario${e?" is-active":""}"
        data-action="activate-scenario"
        data-scenario-id="${l(a.id)}"
        data-testid="scenario-${l(a.id)}"
        ${t.busyAction?"disabled":""}
      >
        <div class="lab-scenario-header">
          <p class="lab-scenario-title">${l(a.label)}</p>
          ${e?'<span class="lab-scenario-badge">Active</span>':""}
        </div>
        <p class="lab-scenario-description">${l(a.description)}</p>
      </button>
    `}).join("");if(a.innerHTML=`
    <div class="lab-shell">
      <div class="lab-grid">
        <aside class="lab-panel lab-sidebar">
          <div class="lab-kicker">Extension QA Surface</div>
          <h1 class="lab-title" data-testid="test-harness-title">Applendium Extension Lab</h1>
          <p class="lab-copy">
            This page drives the real extension popup in a fixture-backed mode so UI work can be validated before shipping.
            Live mode is restorable with one click.
          </p>

          <section class="lab-section">
            <h2 class="lab-section-title">Current State</h2>
            <div class="lab-meta-list">
              <div class="lab-meta-row">
                <span class="lab-meta-label">Mode</span>
                <span class="lab-meta-value" data-testid="testing-mode">${l(!p?.supported?"Unavailable in production build":!p?.active?"Live mode":`Scenario active: ${p.label||p.scenarioId||"Unknown"}`)}</span>
              </div>
              <div class="lab-meta-row">
                <span class="lab-meta-label">Backend</span>
                <span class="lab-meta-value">${l(u.backendBaseUrl||"Unknown")}</span>
              </div>
              <div class="lab-meta-row">
                <span class="lab-meta-label">Premium URL</span>
                <span class="lab-meta-value">${l(u.premiumDashboardUrl||"Not configured")}</span>
              </div>
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Scenario Snapshot</h2>
            <div class="lab-state-grid">
              <div class="lab-state-card">
                <span class="lab-state-label">Auth</span>
                <strong class="lab-state-value" data-testid="state-auth">${l(g)}</strong>
                <span class="lab-state-detail" data-testid="state-account">${l(y)}</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Plan</span>
                <strong class="lab-state-value" data-testid="state-plan">${l(f)}</strong>
                <span class="lab-state-detail">Scenario-backed billing state</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Quota</span>
                <strong class="lab-state-value" data-testid="state-quota">${l(w)}</strong>
                <span class="lab-state-detail">Tracked applications in this fixture</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Sync</span>
                <strong class="lab-state-value" data-testid="state-sync">${l(A)}</strong>
                <span class="lab-state-detail">Matches popup sync messaging inputs</span>
              </div>
            </div>

            <div class="lab-state-summary">
              <div class="lab-summary-row">
                <span class="lab-summary-label">Relevant emails</span>
                <span class="lab-summary-value" data-testid="state-relevant">${l($)}</span>
              </div>
              <div class="lab-chip-row">
                ${S}
              </div>
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Scenario Library</h2>
            <div class="lab-scenarios">
              ${k||'<p class="lab-copy">No scenarios are available in this build.</p>'}
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Actions</h2>
            <div class="lab-actions">
              <button class="lab-button primary" data-action="reload-preview" data-testid="reload-preview" ${t.busyAction?"disabled":""}>
                Reload Preview
              </button>
              <button class="lab-button secondary" data-action="open-popup-tab" data-testid="open-popup-tab" ${t.busyAction?"disabled":""}>
                Open Popup Tab
              </button>
              <button class="lab-button secondary" data-action="live-mode" data-testid="live-mode-button" ${t.busyAction?"disabled":""}>
                Restore Live Mode
              </button>
              <button class="lab-button secondary" data-action="refresh-state" data-testid="refresh-state" ${t.busyAction?"disabled":""}>
                Refresh State
              </button>
            </div>
          </section>
        </aside>

        <main class="lab-panel lab-preview">
          <div class="lab-preview-header">
            <div>
              <h2 class="lab-preview-title">Real Popup Preview</h2>
              <p class="lab-preview-copy">
                ${l(m?.description||"Live extension popup rendered inside the test harness.")}
              </p>
            </div>
            <div class="lab-status-pill">
              <span class="lab-stage${p.active?" is-live":""}"></span>
              <span>${l(p.active?"Fixture active":"Live mode")}</span>
            </div>
          </div>

          <div class="lab-frame-wrap">
            <div class="lab-browser-bar">
            <div class="lab-browser-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="lab-browser-url" data-testid="popup-preview-url">${l(e)}</div>
            </div>

            <div class="lab-frame-card">
              <iframe
                class="lab-frame"
                src="${l(e)}"
                title="Applendium popup preview"
                data-testid="popup-preview-frame"
              ></iframe>
            </div>

            <p class="lab-footer-note">
              The preview is the shipped popup page, not a mocked React-only clone. Scenario state lives in the extension background worker and can be toggled without rewriting production routes.
            </p>
          </div>
        </main>
      </div>
    </div>
  `,d){let e=a.querySelector('[data-testid="popup-preview-frame"]');e&&e.replaceWith(d)}a.querySelectorAll('[data-action="activate-scenario"]').forEach(a=>{a.addEventListener("click",async()=>{let e=a.getAttribute("data-scenario-id");if(e){t.busyAction=`activate:${e}`,r();try{let a=await s({type:"ACTIVATE_EXTENSION_TEST_SCENARIO",scenarioId:e});if(!a?.success)throw Error(a?.error||"Failed to activate the scenario.");t.frameKey=Date.now(),await c()}catch(a){console.error("[extension-lab] activate failed",a),alert(a.message||"Failed to activate the selected scenario.")}finally{t.busyAction=null,r()}}})}),a.querySelector('[data-action="reload-preview"]')?.addEventListener("click",()=>{t.frameKey=Date.now(),r()}),a.querySelector('[data-action="open-popup-tab"]')?.addEventListener("click",async()=>{await chrome.tabs.create({url:i()})}),a.querySelector('[data-action="live-mode"]')?.addEventListener("click",async()=>{t.busyAction="live-mode",r();try{let a=await s({type:"DEACTIVATE_EXTENSION_TEST_MODE"});if(!a?.success)throw Error(a?.error||"Failed to restore live mode.");t.frameKey=Date.now(),await c()}catch(a){console.error("[extension-lab] live mode restore failed",a),alert(a.message||"Failed to restore live mode.")}finally{t.busyAction=null,r()}}),a.querySelector('[data-action="refresh-state"]')?.addEventListener("click",async()=>{t.busyAction="refresh-state",r();try{await c()}finally{t.busyAction=null,r()}})}async function c(){let[a,e]=await Promise.all([s({type:"GET_BUILD_INFO"}),s({type:"GET_EXTENSION_TEST_STATE"})]);t.build=a||null,t.testing=e?.testing||a?.testing||null,t.snapshot=e?.snapshot||null,t.scenarios=e?.scenarios||[]}async function o(){try{await c(),r()}catch(e){console.error("[extension-lab] failed to initialize",e),a&&(a.innerHTML=`<div class="lab-shell"><div class="lab-panel lab-sidebar"><h1 class="lab-title">Applendium Extension Lab</h1><p class="lab-copy">Failed to initialize the extension test lab: ${l(e.message||"Unknown error")}</p></div></div>`)}}chrome.runtime.onMessage.addListener(a=>{a?.type==="EXTENSION_TEST_STATE_CHANGED"&&c().then(()=>r()).catch(()=>{})}),chrome.storage.onChanged.addListener((a,e)=>{"local"===e&&c().then(()=>r()).catch(()=>{})}),o(),setInterval(()=>{c().then(()=>r()).catch(()=>{})},1500);