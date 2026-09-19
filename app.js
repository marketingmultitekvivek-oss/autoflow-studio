const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const STORAGE_KEY = "autoflow.workflows.v1";
const DATA_KEY = "autoflow.csv.v1";
const GLOBAL_KEY = "autoflow.globals.v1";

let workflows = loadJson(STORAGE_KEY, []);
let currentId = workflows[0]?.id || null;
let csvRows = loadJson(DATA_KEY, []);
let editingIndex = -1;

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function loadJson(key,fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
  localStorage.setItem(DATA_KEY, JSON.stringify(csvRows));
  localStorage.setItem(GLOBAL_KEY, $("#globals").value || "");
}
function current(){ return workflows.find(w=>w.id===currentId) || null; }
function defaultWorkflow(name="New workflow"){
  return {id:uid(),name,steps:[],createdAt:Date.now(),updatedAt:Date.now()};
}
function currentGlobals(){
  const raw = $("#globals").value.trim();
  if(!raw) return {};
  try{return JSON.parse(raw)}catch{return {}}
}

function ensureWorkflow(){
  if(!workflows.length){
    const w=defaultWorkflow();
    workflows=[w]; currentId=w.id; saveAll();
  }
}

function stepSummary(step){
  const loc=step.locator||{};
  const target=loc.text||loc.aria||loc.css||"element";
  if(step.action==="navigate") return `Open ${step.url||""}`;
  if(step.action==="click") return `Click ${target}`;
  if(step.action==="type") return `Type "${step.value??""}" into ${target}`;
  if(step.action==="select") return `Select "${step.value??""}" in ${target}`;
  if(step.action==="waitFor") return `Wait for ${target}`;
  if(step.action==="wait") return `Wait ${step.ms||1000} ms`;
  if(step.action==="confirm") return step.message||"Ask for confirmation";
  return step.action||"step";
}
function isRisky(step){
  if(step.requiresConfirmation) return true;
  if(step.action!=="click") return false;
  const t=`${step.locator?.text||""} ${step.locator?.aria||""}`;
  return /\b(publish|delete|remove|send|submit|purchase|buy|pay|approve|trash|post)\b/i.test(t);
}

function renderWorkflows(){
  ensureWorkflow();
  $("#workflowList").innerHTML=workflows.map(w=>`
    <div class="workflow-item ${w.id===currentId?"active":""}" data-id="${w.id}">
      <div class="name">${esc(w.name)}</div>
      <button data-delete="${w.id}" class="danger icon-btn" title="Delete">×</button>
    </div>
  `).join("");
}

function renderEditor(){
  const w=current();
  if(!w) return;
  $("#workflowName").value=w.name;
  $("#steps").innerHTML=w.steps.length ? w.steps.map((s,i)=>`
    <div class="step ${isRisky(s)?"risky":""}">
      <div class="step-num">${i+1}</div>
      <div>
        <div class="step-title">${esc(s.action)}</div>
        <div class="step-desc">${esc(stepSummary(s))}</div>
      </div>
      <div class="step-actions">
        <button data-up="${i}" ${i===0?"disabled":""}>↑</button>
        <button data-down="${i}" ${i===w.steps.length-1?"disabled":""}>↓</button>
        <button data-edit="${i}">Edit</button>
        <button data-remove="${i}" class="danger">×</button>
      </div>
    </div>
  `).join("") : `<p class="muted">No steps yet. Add your first step above.</p>`;
  renderCode();
  renderCsv();
}

function defaultStep(type){
  if(type==="navigate") return {action:"navigate",url:"https://example.com"};
  if(type==="click") return {action:"click",locator:{text:"Button text",css:""}};
  if(type==="type") return {action:"type",locator:{css:"input[name='title']"},value:"{{article_title}}"};
  if(type==="select") return {action:"select",locator:{css:"select"},value:"option-value"};
  if(type==="waitFor") return {action:"waitFor",locator:{text:"Save",css:""},timeout:10000};
  if(type==="wait") return {action:"wait",ms:1000};
  if(type==="confirm") return {action:"confirm",message:"Review the page before continuing."};
  return {action:type};
}

function openStepDialog(i){
  editingIndex=i;
  const step=structuredClone(current().steps[i]);
  $("#stepJson").value=JSON.stringify(step,null,2);

  let html=`<div class="field"><label>Action</label><input id="fAction" value="${esc(step.action)}" disabled></div>`;
  if(step.action==="navigate"){
    html+=`<div class="field"><label>URL</label><input id="fUrl" value="${esc(step.url||"")}"></div>`;
  } else if(["click","type","select","waitFor"].includes(step.action)){
    html+=`
      <div class="field"><label>Visible text</label><input id="fText" value="${esc(step.locator?.text||"")}"></div>
      <div class="field"><label>ARIA label</label><input id="fAria" value="${esc(step.locator?.aria||"")}"></div>
      <div class="field"><label>CSS selector</label><input id="fCss" value="${esc(step.locator?.css||"")}"></div>
    `;
    if(["type","select"].includes(step.action)){
      html+=`<div class="field"><label>Value</label><input id="fValue" value="${esc(step.value??"")}"></div>`;
    }
    if(step.action==="waitFor"){
      html+=`<div class="field"><label>Timeout (ms)</label><input id="fTimeout" type="number" value="${Number(step.timeout||10000)}"></div>`;
    }
    if(step.action==="click"){
      html+=`<div class="field"><label><input id="fConfirm" type="checkbox" ${step.requiresConfirmation?"checked":""} style="width:auto"> Require manual confirmation</label></div>`;
    }
  } else if(step.action==="wait"){
    html+=`<div class="field"><label>Milliseconds</label><input id="fMs" type="number" value="${Number(step.ms||1000)}"></div>`;
  } else if(step.action==="confirm"){
    html+=`<div class="field"><label>Confirmation message</label><input id="fMessage" value="${esc(step.message||"Continue?")}"></div>`;
  }
  $("#stepFields").innerHTML=html;
  $("#stepDialog").showModal();
}

function applyFormToJson(){
  let step=JSON.parse($("#stepJson").value);
  const action=step.action;
  if(action==="navigate" && $("#fUrl")) step.url=$("#fUrl").value;
  if(["click","type","select","waitFor"].includes(action)){
    step.locator=step.locator||{};
    if($("#fText")) step.locator.text=$("#fText").value;
    if($("#fAria")) step.locator.aria=$("#fAria").value;
    if($("#fCss")) step.locator.css=$("#fCss").value;
    if(["type","select"].includes(action) && $("#fValue")) step.value=$("#fValue").value;
    if(action==="waitFor" && $("#fTimeout")) step.timeout=Number($("#fTimeout").value||10000);
    if(action==="click" && $("#fConfirm")) step.requiresConfirmation=$("#fConfirm").checked;
  }
  if(action==="wait" && $("#fMs")) step.ms=Number($("#fMs").value||1000);
  if(action==="confirm" && $("#fMessage")) step.message=$("#fMessage").value;
  return step;
}

function validateWorkflow(){
  const w=current();
  const issues=[];
  if(!w.name.trim()) issues.push("Workflow name is empty.");
  if(!w.steps.length) issues.push("Workflow has no steps.");
  const varPattern=/\{\{\s*([^{}]+?)\s*\}\}/g;
  const available=new Set([
    ...Object.keys(currentGlobals()),
    ...(csvRows[0]?Object.keys(csvRows[0]):[])
  ]);
  w.steps.forEach((s,i)=>{
    if(s.action==="navigate" && !/^https?:\/\//i.test(s.url||"")) issues.push(`Step ${i+1}: navigation URL must start with http:// or https://.`);
    if(["click","type","select","waitFor"].includes(s.action)){
      const l=s.locator||{};
      if(!l.css && !l.text && !l.aria) issues.push(`Step ${i+1}: no locator is defined.`);
    }
    const strings=[];
    function walk(x){
      if(typeof x==="string") strings.push(x);
      else if(Array.isArray(x)) x.forEach(walk);
      else if(x&&typeof x==="object") Object.values(x).forEach(walk);
    }
    walk(s);
    for(const str of strings){
      for(const m of str.matchAll(varPattern)){
        const key=m[1].trim();
        if(!available.has(key) && csvRows.length) issues.push(`Step ${i+1}: variable {{${key}}} is not present in globals or CSV headers.`);
      }
    }
    if(isRisky(s) && !s.requiresConfirmation && s.action==="click") issues.push(`Step ${i+1}: risky-looking click should require confirmation.`);
  });
  const box=$("#validationBox");
  box.classList.remove("hidden","ok","warn");
  if(!issues.length){
    box.classList.add("ok");
    box.innerHTML="<h3>Validation passed</h3><p>No obvious configuration problems were found.</p>";
  }else{
    box.classList.add("warn");
    box.innerHTML=`<h3>${issues.length} item${issues.length===1?"":"s"} to review</h3><ul>${issues.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  }
}

function parseCSV(text){
  text=text.replace(/^\uFEFF/,"");
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++}
      else if(ch==='"') quoted=false;
      else field+=ch;
    }else{
      if(ch==='"') quoted=true;
      else if(ch===","){row.push(field);field=""}
      else if(ch==="\n"){row.push(field);rows.push(row);row=[];field=""}
      else if(ch!=="\r") field+=ch;
    }
  }
  if(field.length||row.length){row.push(field);rows.push(row)}
  const clean=rows.filter(r=>r.some(v=>String(v).trim()!==""));
  if(!clean.length)return[];
  const headers=clean[0].map((h,i)=>String(h).trim()||`Column${i+1}`);
  return clean.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}

function renderCsv(){
  if(!csvRows.length){
    $("#csvInfo").textContent="No CSV loaded.";
    $("#csvPreview").innerHTML="";
    return;
  }
  const headers=Object.keys(csvRows[0]);
  $("#csvInfo").textContent=`${csvRows.length} rows • ${headers.length} columns • Variables: ${headers.map(h=>`{{${h}}}`).join(", ")}`;
  $("#csvPreview").innerHTML=`
    <table>
      <thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${csvRows.slice(0,10).map(r=>`<tr>${headers.map(h=>`<td>${esc(r[h]??"")}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
    ${csvRows.length>10?'<p class="muted">Showing first 10 rows.</p>':""}
  `;
}

function jsString(x){ return JSON.stringify(x??""); }
function locatorCode(step){
  const l=step.locator||{};
  if(l.aria) return `page.getByLabel(${jsString(l.aria)})`;
  if(l.text) return `page.getByText(${jsString(l.text)}, { exact: true })`;
  if(l.css) return `page.locator(${jsString(l.css)})`;
  return `page.locator('body')`;
}
function generatePlaywright(){
  const w=current();
  const lines=[];
  lines.push("import { chromium } from 'playwright';");
  lines.push("import readline from 'node:readline/promises';");
  lines.push("import { stdin as input, stdout as output } from 'node:process';");
  lines.push("");
  lines.push(`const workflowName = ${jsString(w?.name||"AutoFlow workflow")};`);
  lines.push("const browser = await chromium.launch({ headless: false });");
  lines.push("const page = await browser.newPage();");
  lines.push("const rl = readline.createInterface({ input, output });");
  lines.push("");
  lines.push("async function run(vars = {}) {");
  lines.push("  const sub = v => typeof v === 'string' ? v.replace(/\\{\\{\\s*([^{}]+?)\\s*\\}\\}/g, (_,k) => vars[k.trim()] ?? `{{${k.trim()}}}`) : v;");
  for(const s of (w?.steps||[])){
    if(s.action==="navigate") lines.push(`  await page.goto(sub(${jsString(s.url)}), { waitUntil: 'domcontentloaded' });`);
    else if(s.action==="click"){
      if(s.requiresConfirmation || isRisky(s)){
        const msg=s.confirmMessage||`Confirm click: ${s.locator?.text||s.locator?.aria||s.locator?.css||"element"}`;
        lines.push(`  if ((await rl.question(${jsString(msg+" Type YES to continue: ")})).trim() !== 'YES') throw new Error('Cancelled by user');`);
      }
      lines.push(`  await ${locatorCode(s)}.click();`);
    }
    else if(s.action==="type") lines.push(`  await ${locatorCode(s)}.fill(sub(${jsString(s.value)}));`);
    else if(s.action==="select") lines.push(`  await ${locatorCode(s)}.selectOption(sub(${jsString(s.value)}));`);
    else if(s.action==="waitFor") lines.push(`  await ${locatorCode(s)}.waitFor({ state: 'visible', timeout: ${Number(s.timeout||10000)} });`);
    else if(s.action==="wait") lines.push(`  await page.waitForTimeout(${Number(s.ms||1000)});`);
    else if(s.action==="confirm") lines.push(`  if ((await rl.question(${jsString((s.message||"Continue?")+" Type YES to continue: ")})).trim() !== 'YES') throw new Error('Cancelled by user');`);
  }
  lines.push("}");
  lines.push("");
  if(csvRows.length){
    lines.push(`const rows = ${JSON.stringify(csvRows,null,2)};`);
    lines.push(`const globals = ${JSON.stringify(currentGlobals(),null,2)};`);
    lines.push("for (let i = 0; i < rows.length; i++) {");
    lines.push("  console.log(`Running row ${i+1}/${rows.length}`);");
    lines.push("  try {");
    lines.push("    await run({ ...globals, ...rows[i], _row: i + 1 });");
    lines.push("    console.log(`SUCCESS row ${i+1}`);");
    lines.push("  } catch (err) {");
    lines.push("    console.error(`FAILED row ${i+1}:`, err.message);");
    lines.push("    await page.screenshot({ path: `failure-row-${i+1}.png`, fullPage: true }).catch(()=>{});");
    lines.push("  }");
    lines.push("}");
  } else {
    lines.push(`await run(${JSON.stringify(currentGlobals(),null,2)});`);
  }
  lines.push("");
  lines.push("await rl.close();");
  lines.push("await browser.close();");
  return lines.join("\n");
}
function renderCode(){ $("#codeOutput").textContent=generatePlaywright(); }

function download(name,text,type="text/plain"){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function slug(s){ return String(s||"workflow").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"workflow"; }

$("#workflowList").addEventListener("click",e=>{
  const del=e.target.closest("[data-delete]");
  if(del){
    e.stopPropagation();
    if(confirm("Delete this workflow?")){
      workflows=workflows.filter(w=>w.id!==del.dataset.delete);
      currentId=workflows[0]?.id||null;saveAll();renderWorkflows();renderEditor();
    }
    return;
  }
  const item=e.target.closest("[data-id]");
  if(item){currentId=item.dataset.id;renderWorkflows();renderEditor()}
});

$(".toolbar").addEventListener("click",e=>{
  const b=e.target.closest("[data-add]");if(!b)return;
  current().steps.push(defaultStep(b.dataset.add));renderEditor();
});

$("#steps").addEventListener("click",e=>{
  const w=current();
  const up=e.target.closest("[data-up]"),down=e.target.closest("[data-down]"),edit=e.target.closest("[data-edit]"),rm=e.target.closest("[data-remove]");
  if(up){const i=+up.dataset.up;[w.steps[i-1],w.steps[i]]=[w.steps[i],w.steps[i-1]]}
  if(down){const i=+down.dataset.down;[w.steps[i+1],w.steps[i]]=[w.steps[i],w.steps[i+1]]}
  if(rm) w.steps.splice(+rm.dataset.remove,1);
  if(edit) return openStepDialog(+edit.dataset.edit);
  renderEditor();
});

$("#applyStep").addEventListener("click",e=>{
  e.preventDefault();
  try{
    current().steps[editingIndex]=applyFormToJson();
    $("#stepDialog").close();renderEditor();
  }catch(err){alert("Invalid step JSON: "+err.message)}
});

$("#stepJson").addEventListener("input",()=>{});

$("#saveWorkflow").addEventListener("click",()=>{
  const w=current();w.name=$("#workflowName").value.trim()||"Untitled workflow";w.updatedAt=Date.now();
  saveAll();renderWorkflows();renderEditor();
  alert("Saved locally.");
});
$("#workflowName").addEventListener("input",()=>{current().name=$("#workflowName").value;renderWorkflows()});
$("#validateWorkflow").addEventListener("click",validateWorkflow);

function addNew(){
  const w=defaultWorkflow();workflows.unshift(w);currentId=w.id;saveAll();renderWorkflows();renderEditor();
}
$("#newWorkflow").addEventListener("click",addNew);
$("#addWorkflow").addEventListener("click",addNew);

$$(".tabs .tab").forEach(t=>t.addEventListener("click",()=>{
  $$(".tabs .tab").forEach(x=>x.classList.remove("active"));
  $$(".tabpane").forEach(x=>x.classList.add("hidden"));
  t.classList.add("active");$("#"+t.dataset.tab).classList.remove("hidden");
  renderCode();
}));

$("#csvFile").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  csvRows=parseCSV(await f.text());saveAll();renderCsv();renderCode();
});
$("#clearCsv").addEventListener("click",()=>{csvRows=[];saveAll();renderCsv();renderCode()});
$("#sampleCsv").addEventListener("click",()=>{
  download("autoflow-sample.csv",
`url,article_title,meta_description
https://example.com/post-1,Example title 1,Example description 1
https://example.com/post-2,Example title 2,Example description 2
`,"text/csv");
});
$("#globals").addEventListener("input",()=>{saveAll();renderCode()});

$("#copyCode").addEventListener("click",async()=>{await navigator.clipboard.writeText(generatePlaywright());alert("Runner code copied.")});
$("#downloadCode").addEventListener("click",()=>download(`${slug(current().name)}.js`,generatePlaywright(),"text/javascript"));

$("#exportWorkflow").addEventListener("click",()=>{
  const bundle={format:"autoflow-v1",workflow:current(),csvRows,globals:currentGlobals()};
  download(`${slug(current().name)}.autoflow.json`,JSON.stringify(bundle,null,2),"application/json");
});
$("#importWorkflow").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    const w=data.workflow||data;
    if(!w.steps||!Array.isArray(w.steps)) throw new Error("No workflow steps found.");
    w.id=uid();w.name=w.name||"Imported workflow";workflows.unshift(w);currentId=w.id;
    if(Array.isArray(data.csvRows)) csvRows=data.csvRows;
    if(data.globals) $("#globals").value=JSON.stringify(data.globals,null,2);
    saveAll();renderWorkflows();renderEditor();
  }catch(err){alert("Import failed: "+err.message)}
});

$("#loadSample").addEventListener("click",()=>{
  const w={
    id:uid(),name:"Example batch website updater",updatedAt:Date.now(),
    steps:[
      {action:"navigate",url:"{{url}}"},
      {action:"waitFor",locator:{text:"Edit",css:""},timeout:10000},
      {action:"click",locator:{text:"Edit",css:""}},
      {action:"type",locator:{css:"input[name='title']"},value:"{{article_title}}"},
      {action:"type",locator:{css:"textarea[name='description']"},value:"{{meta_description}}"},
      {action:"confirm",message:"Review the page. Continue to the final action?"},
      {action:"click",locator:{text:"Publish",css:""},requiresConfirmation:true}
    ]
  };
  workflows.unshift(w);currentId=w.id;
  csvRows=[
    {url:"https://example.com/post-1",article_title:"Example title 1",meta_description:"Example description 1"},
    {url:"https://example.com/post-2",article_title:"Example title 2",meta_description:"Example description 2"}
  ];
  saveAll();renderWorkflows();renderEditor();
});
$("#clearAll").addEventListener("click",()=>{
  if(!confirm("Clear all locally stored AutoFlow data?"))return;
  localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(DATA_KEY);localStorage.removeItem(GLOBAL_KEY);
  workflows=[];csvRows=[];currentId=null;ensureWorkflow();renderWorkflows();renderEditor();
});

$("#globals").value=localStorage.getItem(GLOBAL_KEY)||"";
ensureWorkflow();renderWorkflows();renderEditor();renderCsv();renderCode();

if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
