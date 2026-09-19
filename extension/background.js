const STORAGE_KEY = "autoflow.extension.workflows.v1";
const sessions = new Map();

function uid(){
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function getWorkflows(){
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setWorkflows(workflows){
  await chrome.storage.local.set({[STORAGE_KEY]:workflows});
}

function dedupePush(steps, step){
  const prev = steps[steps.length - 1];
  if(!prev){ steps.push(step); return; }

  if(step.action === "type" && prev.action === "type" && prev.locator?.css === step.locator?.css){
    steps[steps.length - 1] = step;
    return;
  }
  if(step.action === "navigate" && prev.action === "navigate" && prev.url === step.url) return;
  steps.push(step);
}

function waitTabComplete(tabId, timeout=30000){
  return new Promise((resolve,reject) => {
    const started = Date.now();
    function listener(id, info){
      if(id !== tabId) return;
      if(info.status === "complete"){
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      } else if(Date.now() - started > timeout){
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("Timed out waiting for page to load."));
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for page to load."));
    }, timeout + 250);
  });
}

async function executeInTab(tabId, step){
  const response = await chrome.tabs.sendMessage(tabId,{type:"AUTOFLOW_EXECUTE_STEP",step});
  if(!response?.ok) throw new Error(response?.error || "Step failed.");
}

async function runWorkflow(tabId, workflow){
  for(let i=0;i<workflow.steps.length;i++){
    const step = workflow.steps[i];

    if(step.action === "navigate"){
      await chrome.tabs.update(tabId,{url:step.url});
      await waitTabComplete(tabId);
      await new Promise(r => setTimeout(r,500));
      continue;
    }

    await executeInTab(tabId, step);
    await new Promise(r => setTimeout(r,180));
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if(!changeInfo.url) return;
  const session = sessions.get(tabId);
  if(!session?.recording) return;
  dedupePush(session.steps,{action:"navigate",url:changeInfo.url});
});

chrome.tabs.onRemoved.addListener(tabId => sessions.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const tabId = message.tabId ?? sender.tab?.id;

    if(message.type === "AUTOFLOW_START_RECORDING"){
      if(!tabId) throw new Error("No active tab.");
      const tab = await chrome.tabs.get(tabId);
      const workflow = {
        id:uid(),
        name:(message.name || "Recorded workflow").trim() || "Recorded workflow",
        createdAt:Date.now(),
        updatedAt:Date.now(),
        steps:[]
      };
      if(tab.url && /^https?:/i.test(tab.url)) workflow.steps.push({action:"navigate",url:tab.url});
      sessions.set(tabId,{recording:true,workflowId:workflow.id,name:workflow.name,steps:workflow.steps});
      sendResponse({ok:true,recording:true,steps:workflow.steps});
      return;
    }

    if(message.type === "AUTOFLOW_RECORD_EVENT"){
      if(!tabId) return sendResponse({ok:false});
      const session = sessions.get(tabId);
      if(!session?.recording) return sendResponse({ok:true,ignored:true});
      dedupePush(session.steps,message.step);
      sendResponse({ok:true,count:session.steps.length});
      return;
    }

    if(message.type === "AUTOFLOW_STOP_RECORDING"){
      if(!tabId) throw new Error("No active tab.");
      const session = sessions.get(tabId);
      if(!session?.recording) throw new Error("This tab is not recording.");
      session.recording = false;
      const workflow = {
        id:session.workflowId,
        name:session.name,
        createdAt:Date.now(),
        updatedAt:Date.now(),
        steps:session.steps
      };
      const workflows = await getWorkflows();
      workflows.unshift(workflow);
      await setWorkflows(workflows);
      sessions.delete(tabId);
      sendResponse({ok:true,workflow});
      return;
    }

    if(message.type === "AUTOFLOW_GET_STATE"){
      const workflows = await getWorkflows();
      const session = tabId ? sessions.get(tabId) : null;
      sendResponse({
        ok:true,
        recording:!!session?.recording,
        liveSteps:session?.steps || [],
        workflows
      });
      return;
    }

    if(message.type === "AUTOFLOW_RUN_WORKFLOW"){
      if(!tabId) throw new Error("No active tab.");
      const workflows = await getWorkflows();
      const workflow = workflows.find(w => w.id === message.workflowId);
      if(!workflow) throw new Error("Workflow not found.");
      await runWorkflow(tabId,workflow);
      sendResponse({ok:true});
      return;
    }

    if(message.type === "AUTOFLOW_DELETE_WORKFLOW"){
      const workflows = (await getWorkflows()).filter(w => w.id !== message.workflowId);
      await setWorkflows(workflows);
      sendResponse({ok:true,workflows});
      return;
    }

    if(message.type === "AUTOFLOW_IMPORT_WORKFLOW"){
      const incoming = message.workflow;
      if(!incoming || !Array.isArray(incoming.steps)) throw new Error("Invalid AutoFlow workflow JSON.");
      const workflows = await getWorkflows();
      workflows.unshift({
        ...incoming,
        id:incoming.id || uid(),
        name:incoming.name || "Imported workflow",
        updatedAt:Date.now()
      });
      await setWorkflows(workflows);
      sendResponse({ok:true,workflows});
      return;
    }

    sendResponse({ok:false,error:"Unknown message."});
  })().catch(error => sendResponse({ok:false,error:error.message}));
  return true;
});