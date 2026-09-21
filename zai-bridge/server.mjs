import http from "node:http";
import fs from "node:fs";

function loadEnv(path=".env"){
  if(!fs.existsSync(path)) return;
  for(const raw of fs.readFileSync(path,"utf8").split(/\r?\n/)){
    const line=raw.trim();
    if(!line || line.startsWith("#")) continue;
    const i=line.indexOf("=");
    if(i<1) continue;
    const key=line.slice(0,i).trim();
    let value=line.slice(i+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    if(!(key in process.env)) process.env[key]=value;
  }
}
loadEnv();

const PORT=Number(process.env.PORT||8787);
const API_KEY=process.env.ZAI_API_KEY||"";
const BASE_URL=(process.env.ZAI_BASE_URL||"https://api.z.ai/api/paas/v4").replace(/\/$/,"");
const MODEL=process.env.ZAI_MODEL||"glm-5.3";
const REASONING_EFFORT=process.env.ZAI_REASONING_EFFORT||"low";

const allowedOrigins=new Set([
  "https://marketingmultitekvivek-oss.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

function cors(req,res){
  const origin=req.headers.origin;
  if(origin && (allowedOrigins.has(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))){
    res.setHeader("Access-Control-Allow-Origin",origin);
    res.setHeader("Vary","Origin");
  }
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Private-Network","true");
}

function send(res,status,data){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});
  res.end(JSON.stringify(data));
}

async function readJson(req){
  let body="";
  for await (const chunk of req){
    body+=chunk;
    if(body.length>1_000_000) throw new Error("Request too large");
  }
  return body ? JSON.parse(body) : {};
}

function extractJson(text){
  const raw=String(text||"").trim();
  try{return JSON.parse(raw)}catch{}
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced){
    try{return JSON.parse(fenced[1].trim())}catch{}
  }
  const start=raw.indexOf("{"), end=raw.lastIndexOf("}");
  if(start>=0 && end>start) return JSON.parse(raw.slice(start,end+1));
  throw new Error("Model response was not valid JSON");
}

const allowedActions=new Set(["navigate","click","type","select","waitFor","wait","confirm"]);
function normalizeWorkflow(value){
  if(!value || typeof value!=="object" || !Array.isArray(value.steps)) throw new Error("Workflow JSON must include a steps array");
  const steps=value.steps.map((s,i)=>{
    if(!s || !allowedActions.has(s.action)) throw new Error(`Unsupported action at step ${i+1}`);
    const out={...s};
    if(["click","type","select","waitFor"].includes(out.action)){
      out.locator=out.locator&&typeof out.locator==="object"?out.locator:{};
      const l=out.locator;
      if(!l.text && !l.aria && !l.css) throw new Error(`Step ${i+1} needs text, aria, or css locator`);
      out.locator={...(l.text?{text:String(l.text)}:{}),...(l.aria?{aria:String(l.aria)}:{}),...(l.css?{css:String(l.css)}:{})};
    }
    if(out.action==="click"){
      const label=`${out.locator?.text||""} ${out.locator?.aria||""}`;
      if(/\b(publish|delete|remove|send|submit|purchase|buy|pay|approve|trash|post|confirm order)\b/i.test(label)) out.requiresConfirmation=true;
    }
    return out;
  });
  return {name:String(value.name||"Z.AI generated workflow"),steps};
}

const systemPrompt=`You generate editable AutoFlow Studio browser workflow JSON.
Return ONLY one JSON object with this schema:
{"name":"Short workflow name","steps":[...]}.

Allowed step actions:
1. {"action":"navigate","url":"https://..."}
2. {"action":"click","locator":{"text":"...","aria":"...","css":"..."},"requiresConfirmation":false}
3. {"action":"type","locator":{"text":"...","aria":"...","css":"..."},"value":"..."}
4. {"action":"select","locator":{"text":"...","aria":"...","css":"..."},"value":"..."}
5. {"action":"waitFor","locator":{"text":"...","aria":"...","css":"..."},"timeout":10000}
6. {"action":"wait","ms":1000}
7. {"action":"confirm","message":"..."}

Rules:
- Use only the allowed actions.
- Prefer visible text or ARIA labels over fragile CSS selectors.
- Do not invent passwords, API keys, cookies, tokens, or private data.
- Use {{variable_name}} placeholders when the user's task refers to changing/batch data.
- Add a confirm step before irreversible or consequential actions such as publish, delete, send, purchase, payment, approval, or account changes.
- Also set requiresConfirmation=true on the consequential click itself.
- If exact selectors are unknown, use likely visible text/ARIA and make the workflow easy for the user to edit.
- Do not claim to execute the workflow. You only produce JSON.`;

const server=http.createServer(async(req,res)=>{
  cors(req,res);
  if(req.method==="OPTIONS"){res.writeHead(204);return res.end();}

  if(req.method==="GET" && req.url==="/health"){
    return send(res,200,{ok:true,model:MODEL,apiKeyConfigured:Boolean(API_KEY)});
  }

  if(req.method==="POST" && req.url==="/generate-workflow"){
    if(!API_KEY) return send(res,500,{error:"ZAI_API_KEY is not configured in zai-bridge/.env"});
    try{
      const input=await readJson(req);
      const task=String(input.task||"").trim();
      if(!task) return send(res,400,{error:"Task is required"});
      const context=[
        input.targetSite ? `Target site/app: ${input.targetSite}` : "",
        Array.isArray(input.globals)&&input.globals.length ? `Available global variables: ${input.globals.join(", ")}` : "",
        Array.isArray(input.csvColumns)&&input.csvColumns.length ? `Available CSV columns: ${input.csvColumns.join(", ")}` : ""
      ].filter(Boolean).join("\n");

      const upstream=await fetch(BASE_URL+"/chat/completions",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+API_KEY
        },
        body:JSON.stringify({
          model:MODEL,
          messages:[
            {role:"system",content:systemPrompt},
            {role:"user",content:(context?context+"\n\n":"")+"Task:\n"+task}
          ],
          thinking:{type:"enabled"},
          reasoning_effort:REASONING_EFFORT,
          max_tokens:4096,
          temperature:0.2
        })
      });

      const payload=await upstream.json().catch(()=>({}));
      if(!upstream.ok){
        const msg=payload?.error?.message||payload?.message||`Z.AI request failed with HTTP ${upstream.status}`;
        return send(res,502,{error:msg});
      }

      const content=payload?.choices?.[0]?.message?.content;
      const workflow=normalizeWorkflow(extractJson(content));
      return send(res,200,{workflow,model:MODEL});
    }catch(err){
      return send(res,500,{error:err.message||"Unknown bridge error"});
    }
  }

  send(res,404,{error:"Not found"});
});

server.listen(PORT,"127.0.0.1",()=>{
  console.log(`AutoFlow Z.AI bridge listening at http://127.0.0.1:${PORT}`);
  console.log(`Model: ${MODEL}`);
  console.log(API_KEY ? "ZAI_API_KEY loaded." : "ZAI_API_KEY missing. Copy .env.example to .env and add your key.");
});
