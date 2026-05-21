function e({id:e,threadId:a,category:t,subject:i,from:s,date:r,company:l,position:n,body:o,htmlBody:c,isRead:d=!1,applicationId:p=null,applicationStatus:u=null,isClosed:m=!1,isUserClosed:b=!1}){return{id:e,thread_id:a,category:t,subject:i,from:s,sender:s,date:r,company_name:l,position:n,body:o,html_body:c||`<p>${o}</p>`,preview:o,is_read:d,applicationId:p,application_id:p,applicationStatus:u,isClosed:m,isUserClosed:b,displayCategory:m&&["applied","interviewed"].includes(t)?"closed":t}}const a={applied:[e({id:101,threadId:"northstar-product-manager",category:"applied",subject:"Application received: Senior Product Manager",from:"Northstar Labs Recruiting <jobs@northstarlabs.com>",date:"2026-04-05T12:40:00.000Z",company:"Northstar Labs",position:"Senior Product Manager",body:"Thanks for applying. We have your application and will review it this week.",applicationId:9001,applicationStatus:"applied"}),e({id:102,threadId:"northstar-product-manager",category:"applied",subject:"Application received: Senior Product Manager",from:"Greenhouse <notifications@greenhouse.io>",date:"2026-04-03T15:20:00.000Z",company:"Northstar Labs",position:"Senior Product Manager",body:"Your application for Senior Product Manager has been submitted successfully.",isRead:!0,applicationId:9001,applicationStatus:"applied"}),e({id:103,threadId:"atlas-staff-engineer",category:"applied",subject:"Checking in on your Staff Engineer application",from:"Atlas Talent <talent@atlas.co>",date:"2026-03-10T14:00:00.000Z",company:"Atlas",position:"Staff Engineer",body:"This role has moved forward with other candidates, so we are closing the loop on your application.",isRead:!0,applicationId:9002,applicationStatus:"applied",isClosed:!0,isUserClosed:!0})],interviewed:[e({id:201,threadId:"acme-platform-engineer",category:"interviewed",subject:"Interview scheduled with Acme AI",from:"Acme AI Recruiting <interviews@acme.ai>",date:"2026-04-04T16:30:00.000Z",company:"Acme AI",position:"Platform Engineer",body:"Your second round interview is confirmed for Tuesday at 11:00 AM ET.",applicationId:9003,applicationStatus:"interviewed"}),e({id:202,threadId:"acme-platform-engineer",category:"interviewed",subject:"Interview scheduled with Acme AI",from:"Google Calendar <calendar-notification@google.com>",date:"2026-04-04T15:45:00.000Z",company:"Acme AI",position:"Platform Engineer",body:"Acme AI added a calendar invite for your technical interview.",isRead:!0,applicationId:9003,applicationStatus:"interviewed"})],offers:[e({id:301,threadId:"brightwave-design",category:"offers",subject:"Offer letter for Senior Designer",from:"Brightwave People Ops <people@brightwave.com>",date:"2026-04-02T18:10:00.000Z",company:"Brightwave",position:"Senior Designer",body:"We are excited to share your offer package for the Senior Designer role.",applicationId:9004,applicationStatus:"offers",isRead:!0})],rejected:[e({id:401,threadId:"river-finance-analytics",category:"rejected",subject:"Update on your analytics application",from:"River Finance Talent <careers@riverfinance.com>",date:"2026-03-30T13:10:00.000Z",company:"River Finance",position:"Analytics Lead",body:"We appreciate your time. We have decided not to move forward after this round.",applicationId:9005,applicationStatus:"rejected",isRead:!0})],irrelevant:[e({id:501,threadId:"newsletter-1",category:"irrelevant",subject:"Weekly hiring newsletter",from:"Jobs Weekly <newsletter@jobsweekly.example>",date:"2026-04-01T10:00:00.000Z",company:"",position:"",body:"This is a general newsletter and should stay out of tracked applications.",isRead:!0})]},t={applied:[e({id:601,threadId:"lattice-growth",category:"applied",subject:"Application received: Growth Marketing Lead",from:"Lattice Careers <careers@lattice.com>",date:"2026-04-05T11:20:00.000Z",company:"Lattice",position:"Growth Marketing Lead",body:"We received your application and the hiring team will review it shortly.",applicationId:9101,applicationStatus:"applied"})],interviewed:[e({id:602,threadId:"signal-ml",category:"interviewed",subject:"Final interview loop confirmed",from:"Signal Labs Recruiting <recruiting@signallabs.ai>",date:"2026-04-04T19:05:00.000Z",company:"Signal Labs",position:"ML Engineer",body:"Your final loop is locked in for Friday. We are looking forward to meeting you.",applicationId:9102,applicationStatus:"interviewed"})],offers:[e({id:603,threadId:"orbit-ops",category:"offers",subject:"Offer package for Revenue Operations Director",from:"Orbit HR <hr@orbit.io>",date:"2026-04-01T16:40:00.000Z",company:"Orbit",position:"Revenue Operations Director",body:"Attached is your offer package and benefits summary.",applicationId:9103,applicationStatus:"offers",isRead:!0})],rejected:[],irrelevant:[]},i={applied:[],interviewed:[],offers:[],rejected:[],irrelevant:[]},s={"logged-out":{id:"logged-out",label:"Logged Out",description:"Covers the unauthenticated landing state and Google sign-in CTA.",auth:null,userPlan:"free",quotaData:null,sync:{inProgress:!1,lastSyncAt:null,lastCompletedAt:null,startedAt:null},categorizedEmails:i,applications:{}},"free-rich":{id:"free-rich",label:"Free Plan Rich Inbox",description:"Free-plan state with quota pressure, unread threads, preview history, and closed applications.",auth:{email:"qa.free@applendium.dev",name:"Free Plan QA",userId:"qa-free-001"},userPlan:"free",quotaData:{trackedApplications:82,totalProcessed:82,limit:100,relevantMessagesProcessed:124,limitReached:!1,limitBehavior:"existing_continue_new_paused",next_reset_date:"2026-04-30T00:00:00.000Z"},sync:{inProgress:!1,lastSyncAt:"2026-04-05T12:45:00.000Z",lastCompletedAt:"2026-04-05T12:45:00.000Z",startedAt:null},categorizedEmails:a,applications:{9001:{application:{id:9001,current_status:"applied",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:102,category:"applied",date:"2026-04-03T15:20:00.000Z",subject:"Application received: Senior Product Manager"},{emailId:101,category:"applied",date:"2026-04-05T12:40:00.000Z",subject:"Application received: Senior Product Manager"}]},9002:{application:{id:9002,current_status:"applied",is_closed:!0,user_closed_at:"2026-03-12T09:00:00.000Z"},lifecycle:[{emailId:103,category:"applied",date:"2026-03-10T14:00:00.000Z",subject:"Checking in on your Staff Engineer application"}]},9003:{application:{id:9003,current_status:"interviewed",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:202,category:"applied",date:"2026-04-02T12:00:00.000Z",subject:"Acme AI interview logistics"},{emailId:201,category:"interviewed",date:"2026-04-04T16:30:00.000Z",subject:"Interview scheduled with Acme AI"}]},9004:{application:{id:9004,current_status:"offers",is_closed:!0,user_closed_at:null},lifecycle:[{emailId:301,category:"offers",date:"2026-04-02T18:10:00.000Z",subject:"Offer letter for Senior Designer"}]},9005:{application:{id:9005,current_status:"rejected",is_closed:!0,user_closed_at:null},lifecycle:[{emailId:401,category:"rejected",date:"2026-03-30T13:10:00.000Z",subject:"Update on your analytics application"}]}}},"free-limit-reached":{id:"free-limit-reached",label:"Free Plan Limit Reached",description:"Free-plan state after the tracked application cap is reached, so upgrade pressure and blocked-new-tracking copy can be validated.",auth:{email:"qa.limit@applendium.dev",name:"Limit Reached QA",userId:"qa-limit-001"},userPlan:"free",quotaData:{trackedApplications:100,totalProcessed:100,limit:100,relevantMessagesProcessed:148,limitReached:!0,limitBehavior:"existing_continue_new_paused",next_reset_date:"2026-04-30T00:00:00.000Z"},sync:{inProgress:!1,lastSyncAt:"2026-04-05T12:52:00.000Z",lastCompletedAt:"2026-04-05T12:52:00.000Z",startedAt:null},categorizedEmails:a,applications:{9001:{application:{id:9001,current_status:"applied",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:102,category:"applied",date:"2026-04-03T15:20:00.000Z",subject:"Application received: Senior Product Manager"},{emailId:101,category:"applied",date:"2026-04-05T12:40:00.000Z",subject:"Application received: Senior Product Manager"}]},9002:{application:{id:9002,current_status:"applied",is_closed:!0,user_closed_at:"2026-03-12T09:00:00.000Z"},lifecycle:[{emailId:103,category:"applied",date:"2026-03-10T14:00:00.000Z",subject:"Checking in on your Staff Engineer application"}]},9003:{application:{id:9003,current_status:"interviewed",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:202,category:"applied",date:"2026-04-02T12:00:00.000Z",subject:"Acme AI interview logistics"},{emailId:201,category:"interviewed",date:"2026-04-04T16:30:00.000Z",subject:"Interview scheduled with Acme AI"}]},9004:{application:{id:9004,current_status:"offers",is_closed:!0,user_closed_at:null},lifecycle:[{emailId:301,category:"offers",date:"2026-04-02T18:10:00.000Z",subject:"Offer letter for Senior Designer"}]},9005:{application:{id:9005,current_status:"rejected",is_closed:!0,user_closed_at:null},lifecycle:[{emailId:401,category:"rejected",date:"2026-03-30T13:10:00.000Z",subject:"Update on your analytics application"}]}}},"premium-rich":{id:"premium-rich",label:"Premium Plan Active Search",description:"Premium state for validating no free-plan quota friction and premium footer behavior.",auth:{email:"qa.premium@applendium.dev",name:"Premium QA",userId:"qa-premium-001"},userPlan:"premium",quotaData:{trackedApplications:214,totalProcessed:214,relevantMessagesProcessed:322,limit:100,limitReached:!1,next_reset_date:"2026-04-30T00:00:00.000Z"},sync:{inProgress:!1,lastSyncAt:"2026-04-05T12:15:00.000Z",lastCompletedAt:"2026-04-05T12:15:00.000Z",startedAt:null},categorizedEmails:t,applications:{9101:{application:{id:9101,current_status:"applied",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:601,category:"applied",date:"2026-04-05T11:20:00.000Z",subject:"Application received: Growth Marketing Lead"}]},9102:{application:{id:9102,current_status:"interviewed",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:602,category:"interviewed",date:"2026-04-04T19:05:00.000Z",subject:"Final interview loop confirmed"}]},9103:{application:{id:9103,current_status:"offers",is_closed:!0,user_closed_at:null},lifecycle:[{emailId:603,category:"offers",date:"2026-04-01T16:40:00.000Z",subject:"Offer package for Revenue Operations Director"}]}}},"sync-stuck":{id:"sync-stuck",label:"Sync Stuck Warning",description:"Signed-in state with a long-running sync so the popup warning and recovery copy can be reviewed.",auth:{email:"qa.sync@applendium.dev",name:"Sync QA",userId:"qa-sync-001"},userPlan:"free",quotaData:{trackedApplications:28,totalProcessed:28,limit:100,relevantMessagesProcessed:61,limitReached:!1,limitBehavior:"existing_continue_new_paused",next_reset_date:"2026-04-30T00:00:00.000Z"},sync:{inProgress:!0,startedAt:"2024-01-10T09:00:00.000Z",lastSyncAt:"2024-01-10T09:00:00.000Z",lastCompletedAt:"2024-01-09T21:12:00.000Z"},categorizedEmails:a,applications:{9001:{application:{id:9001,current_status:"applied",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:102,category:"applied",date:"2026-04-03T15:20:00.000Z",subject:"Application received: Senior Product Manager"},{emailId:101,category:"applied",date:"2026-04-05T12:40:00.000Z",subject:"Application received: Senior Product Manager"}]},9003:{application:{id:9003,current_status:"interviewed",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:202,category:"applied",date:"2026-04-02T12:00:00.000Z",subject:"Acme AI interview logistics"},{emailId:201,category:"interviewed",date:"2026-04-04T16:30:00.000Z",subject:"Interview scheduled with Acme AI"}]},9004:{application:{id:9004,current_status:"offers",is_closed:!0,user_closed_at:null},lifecycle:[{emailId:301,category:"offers",date:"2026-04-02T18:10:00.000Z",subject:"Offer letter for Senior Designer"}]}}},"refresh-failure":{id:"refresh-failure",label:"Refresh Failure",description:"Signed-in state with cached tracked emails where a manual refresh fails and the popup must surface the error without losing state.",auth:{email:"qa.refresh-failure@applendium.dev",name:"Refresh Failure QA",userId:"qa-refresh-failure-001"},userPlan:"free",quotaData:{trackedApplications:82,totalProcessed:82,limit:100,relevantMessagesProcessed:124,limitReached:!1,limitBehavior:"existing_continue_new_paused",next_reset_date:"2026-04-30T00:00:00.000Z"},sync:{inProgress:!1,lastSyncAt:"2026-04-05T12:45:00.000Z",lastCompletedAt:"2026-04-05T12:45:00.000Z",startedAt:null},categorizedEmails:a,applications:{9001:{application:{id:9001,current_status:"applied",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:102,category:"applied",date:"2026-04-03T15:20:00.000Z",subject:"Application received: Senior Product Manager"},{emailId:101,category:"applied",date:"2026-04-05T12:40:00.000Z",subject:"Application received: Senior Product Manager"}]},9003:{application:{id:9003,current_status:"interviewed",is_closed:!1,user_closed_at:null},lifecycle:[{emailId:202,category:"applied",date:"2026-04-02T12:00:00.000Z",subject:"Acme AI interview logistics"},{emailId:201,category:"interviewed",date:"2026-04-04T16:30:00.000Z",subject:"Interview scheduled with Acme AI"}]}},simulatedFailures:{refresh:{error:"Mock network timeout while refreshing tracked emails."}}},"empty-inbox":{id:"empty-inbox",label:"Empty Inbox",description:"Logged-in state with no tracked applications yet.",auth:{email:"qa.empty@applendium.dev",name:"Empty Inbox QA",userId:"qa-empty-001"},userPlan:"free",quotaData:{trackedApplications:0,totalProcessed:0,relevantMessagesProcessed:0,limit:100,limitReached:!1,next_reset_date:"2026-04-30T00:00:00.000Z"},sync:{inProgress:!1,lastSyncAt:"2026-04-05T11:55:00.000Z",lastCompletedAt:"2026-04-05T11:55:00.000Z",startedAt:null},categorizedEmails:i,applications:{}}},r=document.getElementById("root"),l=chrome.runtime.getURL("popup/public/index.html"),n=Object.values(s).map(e=>({id:e.id,label:e.label,description:e.description})),o={build:null,testing:null,snapshot:null,scenarios:n,busyAction:null,frameKey:Date.now(),renderSignature:null,lastError:null};async function c(e,{timeoutMs:a=1e4}={}){let t=null;try{return await Promise.race([chrome.runtime.sendMessage(e),new Promise((i,s)=>{t=setTimeout(()=>{s(Error(`Extension test message timed out after ${a}ms: ${e?.type||"unknown"}`))},a)})])}finally{t&&clearTimeout(t)}}function d(){return`${l}?lab=1&frame=${o.frameKey}`}function p(e){return e?.supported?e?.active?`Scenario active: ${e.label||e.scenarioId||"Unknown"}`:"Live mode":"Unavailable in production build"}function u(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function m(e){if(!e)return"Unavailable";let a=new Date(e);return Number.isNaN(a.getTime())?"Unavailable":a.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}function b(e){return"premium"===e?"Premium":"Free"}function g(e){if(!e?.auth?.isLoggedIn)return"Signed out";let a=e?.quota||null;if(!a)return"Unavailable";let t=function(e){let a=e?.quota||null;return a?Number.isFinite(a.trackedApplications)?a.trackedApplications:Number.isFinite(a.usage)?a.usage:Number.isFinite(e?.trackedApplications)?e.trackedApplications:Number(a.totalProcessed||0):Number(e?.trackedApplications||0)}(e);if(e?.userPlan==="premium")return`${t} tracked - Unlimited`;let i=Number(a.limit||100);return a.limitReached||t>=i?`${t}/${i} tracked - Limit reached`:`${t}/${i} tracked`}function v(e){let a=e?.sync||null;if(!e?.auth?.isLoggedIn)return"Signed out";if(!a?.inProgress){let e=a?.lastCompletedAt||a?.lastSyncAt;return e?`Idle - last ${m(e)}`:"Idle"}let t=a?.startedAt||a?.lastSyncAt;return t?`In progress - started ${m(t)}`:"In progress"}function f(){if(!r)return;let e=d(),a=r.querySelector('[data-testid="popup-preview-frame"]'),t=a&&a.getAttribute("src")===e?a:null,i=o.testing||{supported:!1,active:!1},s=(o.build||{}).runtime||{},l=o.snapshot||null,m=i.scenarioId||null,y=o.scenarios.find(e=>e.id===m)||null,w=l?.categoryTotals||{},A=l?.auth?.isLoggedIn?"Signed in":"Signed out",_=l?.auth?.email||"Unavailable",T=l?.auth?.isLoggedIn?b(l?.userPlan):"N/A",I=g(l),S=v(l),E=Number(w.relevant||0),k=["applied","interviewed","offers","rejected","irrelevant"].map(e=>`
      <span class="lab-chip" data-testid="state-count-${u(e)}">
        ${u(e)}: ${u(w[e]??0)}
      </span>
    `).join(""),P=JSON.stringify({popupUrl:e,busyAction:o.busyAction,testing:i,snapshot:l,scenarios:o.scenarios,runtime:{backendBaseUrl:s.backendBaseUrl||null,premiumDashboardUrl:s.premiumDashboardUrl||null},lastError:o.lastError});if(o.renderSignature===P)return;o.renderSignature=P;let j=o.scenarios.map(e=>{let a=m===e.id;return`
      <button
        class="lab-scenario${a?" is-active":""}"
        data-action="activate-scenario"
        data-scenario-id="${u(e.id)}"
        data-testid="scenario-${u(e.id)}"
        ${o.busyAction?"disabled":""}
      >
        <div class="lab-scenario-header">
          <p class="lab-scenario-title">${u(e.label)}</p>
          ${a?'<span class="lab-scenario-badge">Active</span>':""}
        </div>
        <p class="lab-scenario-description">${u(e.description)}</p>
      </button>
    `}).join("");if(r.innerHTML=`
    <div class="lab-shell">
      <div class="lab-grid">
        <aside class="lab-panel lab-sidebar">
          <div class="lab-kicker">Extension QA Surface</div>
          <h1 class="lab-title" data-testid="test-harness-title">Applendium Extension Lab</h1>
          <p class="lab-copy">
            This page drives the real extension popup in a fixture-backed mode so UI work can be validated before shipping.
            Live mode is restorable with one click.
          </p>

          ${o.lastError?`<div class="lab-copy" data-testid="lab-error">${u(o.lastError)}</div>`:""}

          <section class="lab-section">
            <h2 class="lab-section-title">Current State</h2>
            <div class="lab-meta-list">
              <div class="lab-meta-row">
                <span class="lab-meta-label">Mode</span>
                <span class="lab-meta-value" data-testid="testing-mode">${u(p(i))}</span>
              </div>
              <div class="lab-meta-row">
                <span class="lab-meta-label">Backend</span>
                <span class="lab-meta-value">${u(s.backendBaseUrl||"Unknown")}</span>
              </div>
              <div class="lab-meta-row">
                <span class="lab-meta-label">Premium URL</span>
                <span class="lab-meta-value">${u(s.premiumDashboardUrl||"Not configured")}</span>
              </div>
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Scenario Snapshot</h2>
            <div class="lab-state-grid">
              <div class="lab-state-card">
                <span class="lab-state-label">Auth</span>
                <strong class="lab-state-value" data-testid="state-auth">${u(A)}</strong>
                <span class="lab-state-detail" data-testid="state-account">${u(_)}</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Plan</span>
                <strong class="lab-state-value" data-testid="state-plan">${u(T)}</strong>
                <span class="lab-state-detail">Scenario-backed billing state</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Quota</span>
                <strong class="lab-state-value" data-testid="state-quota">${u(I)}</strong>
                <span class="lab-state-detail">Tracked applications in this fixture</span>
              </div>
              <div class="lab-state-card">
                <span class="lab-state-label">Sync</span>
                <strong class="lab-state-value" data-testid="state-sync">${u(S)}</strong>
                <span class="lab-state-detail">Matches popup sync messaging inputs</span>
              </div>
            </div>

            <div class="lab-state-summary">
              <div class="lab-summary-row">
                <span class="lab-summary-label">Relevant emails</span>
                <span class="lab-summary-value" data-testid="state-relevant">${u(E)}</span>
              </div>
              <div class="lab-chip-row">
                ${k}
              </div>
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Scenario Library</h2>
            <div class="lab-scenarios">
              ${j||'<p class="lab-copy">No scenarios are available in this build.</p>'}
            </div>
          </section>

          <section class="lab-section">
            <h2 class="lab-section-title">Actions</h2>
            <div class="lab-actions">
              <button class="lab-button primary" data-action="reload-preview" data-testid="reload-preview" ${o.busyAction?"disabled":""}>
                Reload Preview
              </button>
              <button class="lab-button secondary" data-action="open-popup-tab" data-testid="open-popup-tab" ${o.busyAction?"disabled":""}>
                Open Popup Tab
              </button>
              <button class="lab-button secondary" data-action="live-mode" data-testid="live-mode-button" ${o.busyAction?"disabled":""}>
                Restore Live Mode
              </button>
              <button class="lab-button secondary" data-action="refresh-state" data-testid="refresh-state" ${o.busyAction?"disabled":""}>
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
                ${u(y?.description||"Live extension popup rendered inside the test harness.")}
              </p>
            </div>
            <div class="lab-status-pill">
              <span class="lab-stage${i.active?" is-live":""}"></span>
              <span>${u(i.active?"Fixture active":"Live mode")}</span>
            </div>
          </div>

          <div class="lab-frame-wrap">
            <div class="lab-browser-bar">
            <div class="lab-browser-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="lab-browser-url" data-testid="popup-preview-url">${u(e)}</div>
            </div>

            <div class="lab-frame-card">
              <iframe
                class="lab-frame"
                src="${u(e)}"
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
  `,t){let e=r.querySelector('[data-testid="popup-preview-frame"]');e&&e.replaceWith(t)}r.querySelectorAll('[data-action="activate-scenario"]').forEach(e=>{e.addEventListener("click",async()=>{let a=e.getAttribute("data-scenario-id");if(a){o.busyAction=`activate:${a}`,f();try{let e=await c({type:"ACTIVATE_EXTENSION_TEST_SCENARIO",scenarioId:a},{timeoutMs:3e4});if(!e?.success)throw Error(e?.error||"Failed to activate the scenario.");o.lastError=null;let t=n.find(e=>e.id===a);o.testing=e.testing||{supported:!0,active:!0,scenarioId:a,label:t?.label||a,description:t?.description||null},o.frameKey=Date.now(),await h().catch(e=>{console.warn("[extension-lab] refresh after activation failed",e)}),o.testing=e.testing||o.testing}catch(e){console.error("[extension-lab] activate failed",e),o.lastError=e.message||"Failed to activate the selected scenario."}finally{o.busyAction=null,f()}}})}),r.querySelector('[data-action="reload-preview"]')?.addEventListener("click",()=>{o.frameKey=Date.now(),f()}),r.querySelector('[data-action="open-popup-tab"]')?.addEventListener("click",async()=>{await chrome.tabs.create({url:d()})}),r.querySelector('[data-action="live-mode"]')?.addEventListener("click",async()=>{o.busyAction="live-mode",f();try{let e=await c({type:"DEACTIVATE_EXTENSION_TEST_MODE"},{timeoutMs:3e4});if(!e?.success)throw Error(e?.error||"Failed to restore live mode.");o.lastError=null,o.testing=e.testing||o.testing,o.frameKey=Date.now(),await h().catch(e=>{console.warn("[extension-lab] refresh after live mode restore failed",e)})}catch(e){console.error("[extension-lab] live mode restore failed",e),o.lastError=e.message||"Failed to restore live mode."}finally{o.busyAction=null,f()}}),r.querySelector('[data-action="refresh-state"]')?.addEventListener("click",async()=>{o.busyAction="refresh-state",f();try{await h()}finally{o.busyAction=null,f()}})}function y(){if(!r)return;let e=o.testing||{supported:!1,active:!1},a=(o.build||{}).runtime||{},t=o.snapshot||null,i=e.scenarioId||null,s=o.scenarios.find(e=>e.id===i)||null,l=t?.categoryTotals||{},n=["applied","interviewed","offers","rejected","irrelevant"].map(e=>`
      <span class="lab-chip" data-testid="state-count-${u(e)}">
        ${u(e)}: ${u(l[e]??0)}
      </span>
    `).join(""),c=s?.description||"Live extension popup rendered inside the test harness.",d=(e,a)=>{let t=r.querySelector(e);t&&(t.textContent=a)};d('[data-testid="testing-mode"]',p(e)),d('[data-testid="state-auth"]',t?.auth?.isLoggedIn?"Signed in":"Signed out"),d('[data-testid="state-account"]',t?.auth?.email||"Unavailable"),d('[data-testid="state-plan"]',t?.auth?.isLoggedIn?b(t?.userPlan):"N/A"),d('[data-testid="state-quota"]',g(t)),d('[data-testid="state-sync"]',v(t)),d('[data-testid="state-relevant"]',String(Number(l.relevant||0))),d(".lab-preview-copy",c),d(".lab-status-pill span:last-child",e.active?"Fixture active":"Live mode");let m=r.querySelector(".lab-chip-row");m&&(m.innerHTML=n);let f=r.querySelector('[data-testid="lab-error"]');o.lastError?f&&(f.textContent=o.lastError):f&&f.remove(),r.querySelectorAll('[data-action="activate-scenario"]').forEach(e=>{let a=e.getAttribute("data-scenario-id")===i;e.classList.toggle("is-active",a),e.disabled=!!o.busyAction;let t=e.querySelector(".lab-scenario-header"),s=e.querySelector(".lab-scenario-badge");if(a&&!s&&t){let e=document.createElement("span");e.className="lab-scenario-badge",e.textContent="Active",t.appendChild(e)}else!a&&s&&s.remove()}),r.querySelectorAll("[data-action]").forEach(e=>{e.disabled=!!o.busyAction});let y=r.querySelectorAll(".lab-meta-value")[1];y&&(y.textContent=a.backendBaseUrl||"Unknown");let h=r.querySelectorAll(".lab-meta-value")[2];h&&(h.textContent=a.premiumDashboardUrl||"Not configured")}async function h(){let[e,a]=await Promise.allSettled([c({type:"GET_BUILD_INFO"}),c({type:"GET_EXTENSION_TEST_STATE"})]),t="fulfilled"===e.status?e.value:null,i="fulfilled"===a.status?a.value:null;"rejected"===e.status&&console.warn("[extension-lab] GET_BUILD_INFO failed",e.reason),"rejected"===a.status&&console.warn("[extension-lab] GET_EXTENSION_TEST_STATE failed",a.reason);let s=[];"rejected"===e.status?s.push(e.reason?.message||"GET_BUILD_INFO failed"):t&&!1===t.success&&s.push(t.error||"GET_BUILD_INFO failed"),"rejected"===a.status?s.push(a.reason?.message||"GET_EXTENSION_TEST_STATE failed"):i&&!1===i.success&&s.push(i.error||"GET_EXTENSION_TEST_STATE failed"),o.build=t||o.build||{success:!1,runtime:{},testing:{supported:!0,active:!1}},o.testing=i?.testing||o.testing||t?.testing||{supported:!0,active:!1},o.snapshot=i?.snapshot||o.snapshot||null,o.scenarios=i?.scenarios?.length?i.scenarios:o.scenarios||n,o.lastError=s.length>0?s[0]:null}async function w(){try{f(),await h(),o.lastError=null,f()}catch(e){console.error("[extension-lab] failed to initialize",e),r&&(r.innerHTML=`<div class="lab-shell"><div class="lab-panel lab-sidebar"><h1 class="lab-title">Applendium Extension Lab</h1><p class="lab-copy">Failed to initialize the extension test lab: ${u(e.message||"Unknown error")}</p></div></div>`)}}chrome.runtime.onMessage.addListener(e=>{e?.type==="EXTENSION_TEST_STATE_CHANGED"&&h().then(()=>y()).catch(()=>{})}),chrome.storage.onChanged.addListener((e,a)=>{"local"===a&&h().then(()=>y()).catch(()=>{})}),w(),setInterval(()=>{h().then(()=>y()).catch(()=>{})},1500);