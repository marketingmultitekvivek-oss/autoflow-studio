const $ = s => document.querySelector(s);

let tabId = null;
let workflows = [];

function esc(s=""){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function summary(step){
  if(step.action === "navigate") return "Open " + (step.url || "");
  if(step.action === "click") return "Click " + (step.locator?.text || step.locator?.css || "element");
  if(step.action === "type") return "Type into " + (step.locator?.css || "field");
  if(step.action === "select") return "Select " + (step.value || "");
  if(step.action === "wait") return "Wait " + (step.ms || 1000) + " ms";
  if(step.action === "waitFor") return "Wait for " + (step.locator?.text || step.locator?.css || "element");
  if(step.action === "confirm") return step.message || "Confirm";
  return step.action;
}

function message(text,type=""){
  const el = $("#message");
  el.textContent = text;
  el.className = "message " + type;
}

async function activeTab(){
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id) throw new Error("No active browser tab.");
  tabId = tab.id;
  return tab;
}

async function send(type,extra={}){
  const response = await chrome.runtime.sendMessage({type,tabId,...extra});
  if(!response?.ok) throw new Error(response?.error || "AutoFlow request failed.");
  return response;
}

function selectedWorkflow(){
  return workflows.find(w => w.id === $("#workflowSelect").value) || null;
}

function renderWorkflow(){
  const select = $("#workflowSelect");
  const selectedId = select.value;
  select.innerHTML = workflows.length
    ? workflows.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")
    : '<option value="">No saved workflows</option>';
  if(workflows.some(w => w.id === selectedId)) select.value = selectedId;

  const w = selectedWorkflow();
  $("#workflowInfo").textContent = w ? `${w.steps.length} recorded step${w.steps.length===1?"":"s"}` : "No saved workflow selected.";
  $("#stepList").innerHTML = w ? w.steps.map(s => `<li>${esc(summary(s))}</li>`).join("") : "";
  $("#runBtn").disabled = !w;
  $("#deleteBtn").disabled = !w;
  $("#exportBtn").disabled = !w;
}

async function refresh(){
  await activeTab();
  const state = await send("AUTOFLOW_GET_STATE");
  workflows = state.workflows || [];
  $("#recordingStatus").textContent = state.recording ? `Recording… ${state.liveSteps.length} step(s)` : "Not recording.";
  $("#recordingStatus").className = "status " + (state.recording ? "recording" : "");
  $("#startBtn").disabled = state.recording;
  $("#stopBtn").disabled = !state.recording;
  renderWorkflow();
}

$("#startBtn").addEventListener("click", async () => {
  try{
    const tab = await activeTab();
    if(!/^https?:/i.test(tab.url || "")) throw new Error("Open a normal web page before recording.");
    await send("AUTOFLOW_START_RECORDING",{name:$("#workflowName").value});
    message("Recording started. Interact with the page, then reopen AutoFlow and stop/save.","success");
    await refresh();
  }catch(e){ message(e.message,"error"); }
});

$("#stopBtn").addEventListener("click", async () => {
  try{
    const response = await send("AUTOFLOW_STOP_RECORDING");
    message(`Saved "${response.workflow.name}".`,"success");
    await refresh();
  }catch(e){ message(e.message,"error"); }
});

$("#workflowSelect").addEventListener("change",renderWorkflow);

$("#runBtn").addEventListener("click", async () => {
  const w = selectedWorkflow();
  if(!w) return;
  try{
    message("Running workflow…");
    await send("AUTOFLOW_RUN_WORKFLOW",{workflowId:w.id});
    message("Workflow finished.","success");
  }catch(e){ message(e.message,"error"); }
});

$("#deleteBtn").addEventListener("click", async () => {
  const w = selectedWorkflow();
  if(!w || !confirm(`Delete "${w.name}"?`)) return;
  try{
    const response = await send("AUTOFLOW_DELETE_WORKFLOW",{workflowId:w.id});
    workflows = response.workflows || [];
    renderWorkflow();
    message("Workflow deleted.","success");
  }catch(e){ message(e.message,"error"); }
});

$("#exportBtn").addEventListener("click", () => {
  const w = selectedWorkflow();
  if(!w) return;
  const blob = new Blob([JSON.stringify(w,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (w.name || "autoflow-workflow").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") + ".autoflow.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

$("#importFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    await send("AUTOFLOW_IMPORT_WORKFLOW",{workflow:data.workflow || data});
    message("Workflow imported.","success");
    await refresh();
  }catch(e){ message("Import failed: " + e.message,"error"); }
  event.target.value = "";
});

refresh().catch(e => message(e.message,"error"));