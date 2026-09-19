(() => {
  const INPUT_TIMERS = new WeakMap();

  function isSensitive(el){
    if(!(el instanceof Element)) return false;
    const type = (el.getAttribute("type") || "").toLowerCase();
    const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
    const haystack = [
      el.id, el.getAttribute("name"), el.getAttribute("aria-label"),
      el.getAttribute("placeholder"), autocomplete
    ].filter(Boolean).join(" ").toLowerCase();

    if(type === "password") return true;
    if(/one-time-code|cc-number|cc-csc|cc-exp|new-password|current-password/.test(autocomplete)) return true;
    return /password|passwd|secret|token|api.?key|credit.?card|card.?number|cvv|cvc|security.?code/.test(haystack);
  }

  function cssEscape(value){
    if(window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, c => "\\" + c);
  }

  function selectorFor(el){
    if(!(el instanceof Element)) return "";
    if(el.id) return "#" + cssEscape(el.id);

    for(const attr of ["data-testid","data-test","data-qa"]){
      const value = el.getAttribute(attr);
      if(value) return `[${attr}="${String(value).replace(/"/g,'\\\"')}"]`;
    }

    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    if(name) return `${tag}[name="${String(name).replace(/"/g,'\\\"')}"]`;

    const aria = el.getAttribute("aria-label");
    if(aria) return `${tag}[aria-label="${String(aria).replace(/"/g,'\\\"')}"]`;

    const parts = [];
    let node = el;
    while(node && node.nodeType === 1 && parts.length < 5){
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if(parent){
        const siblings = [...parent.children].filter(x => x.tagName === node.tagName);
        if(siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node)+1})`;
      }
      parts.unshift(part);
      if(parent && parent.id){
        parts.unshift("#" + cssEscape(parent.id));
        break;
      }
      node = parent;
    }
    return parts.join(" > ");
  }

  function textFor(el){
    const aria = el.getAttribute?.("aria-label");
    if(aria) return aria.trim().slice(0,120);
    const txt = (el.innerText || el.textContent || "").trim().replace(/\s+/g," ");
    return txt.slice(0,120);
  }

  function riskyLabel(label){
    return /\b(publish|delete|remove|send|submit|purchase|buy|pay|approve|trash|post|place order|confirm order)\b/i.test(label || "");
  }

  function sendStep(step){
    chrome.runtime.sendMessage({type:"AUTOFLOW_RECORD_EVENT", step}).catch(() => {});
  }

  document.addEventListener("click", event => {
    const el = event.target instanceof Element ? event.target.closest("button,a,input,select,textarea,[role='button'],[role='link']") : null;
    if(!el || isSensitive(el)) return;

    const label = textFor(el);
    sendStep({
      action:"click",
      locator:{css:selectorFor(el), text:label || ""},
      risky:riskyLabel(label)
    });
  }, true);

  document.addEventListener("input", event => {
    const el = event.target;
    if(!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return;
    if(isSensitive(el)) return;

    clearTimeout(INPUT_TIMERS.get(el));
    const timer = setTimeout(() => {
      const value = el.isContentEditable ? el.textContent : el.value;
      sendStep({
        action:"type",
        locator:{css:selectorFor(el)},
        value:String(value ?? "")
      });
    }, 700);
    INPUT_TIMERS.set(el, timer);
  }, true);

  document.addEventListener("change", event => {
    const el = event.target;
    if(!(el instanceof HTMLSelectElement) || isSensitive(el)) return;
    sendStep({
      action:"select",
      locator:{css:selectorFor(el)},
      value:el.value
    });
  }, true);

  function find(step){
    const css = step?.locator?.css;
    if(css){
      try {
        const el = document.querySelector(css);
        if(el) return el;
      } catch {}
    }

    const wanted = (step?.locator?.text || "").trim();
    if(wanted){
      const candidates = [...document.querySelectorAll("button,a,[role='button'],[role='link'],label")];
      return candidates.find(el => textFor(el) === wanted) || null;
    }
    return null;
  }

  function waitForElement(step, timeout=10000){
    return new Promise((resolve,reject) => {
      const started = Date.now();
      const tick = () => {
        const el = find(step);
        if(el) return resolve(el);
        if(Date.now() - started > timeout) return reject(new Error("Element not found: " + (step?.locator?.css || step?.locator?.text || "unknown")));
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  async function execute(step){
    if(step.action === "wait"){
      await new Promise(r => setTimeout(r, Number(step.ms || 1000)));
      return;
    }

    if(step.action === "confirm"){
      if(!window.confirm(step.message || "Continue workflow?")) throw new Error("Cancelled by user.");
      return;
    }

    const el = await waitForElement(step, Number(step.timeout || 10000));
    el.scrollIntoView({block:"center", inline:"center"});

    if(step.action === "click"){
      if(step.risky || step.requiresConfirmation){
        const label = step.locator?.text || step.locator?.css || "this element";
        if(!window.confirm("AutoFlow wants to click: " + label + "\n\nContinue?")) throw new Error("Cancelled by user.");
      }
      el.click();
      return;
    }

    if(step.action === "type"){
      if(isSensitive(el)) throw new Error("AutoFlow will not type into a sensitive field.");
      el.focus();
      if("value" in el) el.value = String(step.value ?? "");
      else el.textContent = String(step.value ?? "");
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
      return;
    }

    if(step.action === "select"){
      if(!(el instanceof HTMLSelectElement)) throw new Error("Recorded select target is not a <select> element.");
      el.value = String(step.value ?? "");
      el.dispatchEvent(new Event("change",{bubbles:true}));
      return;
    }

    if(step.action === "waitFor") return;
    throw new Error("Unsupported step: " + step.action);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message?.type !== "AUTOFLOW_EXECUTE_STEP") return;
    execute(message.step)
      .then(() => sendResponse({ok:true}))
      .catch(error => sendResponse({ok:false,error:error.message}));
    return true;
  });
})();