
(async () => {
if (!montarPagina('relatorios.html', 'Relatórios')) return;
const B = "assets/banner.webp";
let dados; try { dados = await carregarTudo(); } catch (e) { erro(e); return; }
const D = { obras: dados.obras.map((o) => ({ id: o.id, n: o.nome || '', c: o.cliente || '', e: o.endereco || '', s: o.status, i: o.data_inicio_prevista || '', f: o.data_conclusao_prevista || '',
  et: dados.etapas.filter((e) => e.obra_id === o.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((e) => [e.nome || '', e.responsavel_nome || '', e.data_inicio || '', e.data_fim || '', Number(e.percentual) || 0, e.status, e.observacoes || '']) })) };
D.obras.sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
const now=new Date(),p2=x=>String(x).padStart(2,"0"),HOJE=`${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())}`;
const EMIT=now.toLocaleDateString("pt-BR")+" às "+now.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
const ST={nao_iniciada:"Não iniciada",pendente:"Pendente",em_andamento:"Em andamento",pausada:"Pausada",concluida:"Concluída",atrasada:"Atrasada"};
const CR={nao_iniciada:"#94a3b8",pendente:"#94a3b8",em_andamento:"#2563eb",pausada:"#f59e0b",concluida:"#16a34a",atrasada:"#dc2626"};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fd=i=>i?i.split("-").reverse().join("/"):"—";
const dias=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const ef=(s,f)=>(["em_andamento","nao_iniciada","pendente"].includes(s)&&f&&f<HOJE)?"atrasada":s;
const prog=o=>o.et.length?Math.round(o.et.reduce((a,e)=>a+e[4],0)/o.et.length):(o.s==="concluida"?100:0);
const ns=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const titulo=s=>s.toLowerCase().replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g,x=>x.toLowerCase()).replace(/^./,c=>c.toUpperCase());
D.obras.forEach(o=>o.et.forEach(e=>{e.tipo=tipoEtapa(e[0]);e.fase=faseEtapa(e[0])}));
const nome=o=>$("#o-pad").checked?titulo(o.n):o.n;
const nomeE=s=>{if(!$("#o-pad").checked)return s;const t=s.trim();return(t===t.toUpperCase()&&t.length<=5)?t:t.charAt(0).toUpperCase()+t.slice(1).toLowerCase()};
const bd=s=>`<span class="bd" style="background:${CR[s]}">${ST[s]}</span>`;
const pb=p=>`<div class="pb ${p>=100?"ok":""}" style="flex:1"><i style="width:${Math.min(100,p)}%"></i></div>`;
const resp=o=>{const c={};o.et.filter(e=>e[1]).forEach(e=>c[e[1]]=(c[e[1]]||0)+1);return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).join(", ")||"—"};
const sel=new Set(D.obras.map((_,i)=>i));
// ---- lista de obras
$("#o-sit").innerHTML='<option value="">Todas as situações</option>'+["em_andamento","concluida","pausada","atrasada","nao_iniciada"].map(k=>`<option value="${k}">${ST[k]}</option>`).join("");
function visiveis(){const q=ns($("#o-q").value),s=$("#o-sit").value;return D.obras.map((o,i)=>i).filter(i=>{const o=D.obras[i];return(!s||ef(o.s,o.f)===s)&&(!q||ns(o.n+" "+o.c).includes(q))})}
function lista(){$("#lst").innerHTML=visiveis().map(i=>{const o=D.obras[i];return`<label><input type="checkbox" data-i="${i}" ${sel.has(i)?"checked":""}><i style="background:${CR[ef(o.s,o.f)]}"></i>${esc(nome(o))}</label>`}).join("")||'<span class="cnt">Nenhuma obra.</span>';
 $("#cnt").textContent=`${sel.size} de ${D.obras.length} obras selecionadas`}
$("#lst").onchange=e=>{const i=+e.target.dataset.i;e.target.checked?sel.add(i):sel.delete(i);render()};
$("#b-todas").onclick=()=>{visiveis().forEach(i=>sel.add(i));render()};$("#b-nenhuma").onclick=()=>{visiveis().forEach(i=>sel.delete(i));render()};
$("#o-q").oninput=$("#o-sit").onchange=lista;["#o-dash","#o-det","#o-obs","#o-pad","#o-fase"].forEach(s=>$(s).onchange=render);
$("#b-pdf").onclick=()=>window.print();
// ---- blocos do relatório
function blocos(){
 const L=[...sel].sort((a,b)=>a-b).map(i=>D.obras[i]),B_=[],add=(h,kw)=>B_.push({h,kw}),fase=$("#o-fase").value;
 const E=L.flatMap(o=>o.et.map(e=>({o,e,n:e[0],r:e[1],f:e[3],p:e[4],s:e[5],tipo:e.tipo,fase:e.fase}))),tot=L.length||1;
 const co=k=>L.filter(o=>ef(o.s,o.f)===k).length,ce=k=>E.filter(x=>ef(x.s,x.f)===k).length;
 const K=(t,v,c)=>`<div class="k" style="border-left-color:${c}"><b>${v}</b><span>${t}</span></div>`;
 if($("#o-dash").checked){
  const so=["em_andamento","concluida","atrasada","pausada","nao_iniciada"];let ac=0;const grad=so.filter(k=>co(k)).map(k=>{const a=ac/tot*100;ac+=co(k);return`${CR[k]} ${a}% ${ac/tot*100}%`}).join(","),media=Math.round(L.reduce((a,o)=>a+prog(o),0)/tot);
  add(`<h2>Dashboard — indicadores</h2><div class="kp">${K("Obras",L.length,"#3c454e")}${K("Em andamento",co("em_andamento"),CR.em_andamento)}${K("Concluídas",co("concluida"),CR.concluida)}${K("Atrasadas",co("atrasada"),CR.atrasada)}${K("Pausadas",co("pausada"),CR.pausada)}${K("Não iniciadas",co("nao_iniciada"),CR.nao_iniciada)}</div><div class="kp q4">${K("Etapas",E.length,"#3c454e")}${K("Em andamento",ce("em_andamento"),CR.em_andamento)}${K("Concluídas",ce("concluida"),CR.concluida)}${K("Atrasadas",ce("atrasada"),CR.atrasada)}</div>`);
  add(`<div class="cols"><div class="box dn"><div class="dg" style="background:conic-gradient(${grad||"#94a3b8 0 100%"})"><b>${L.length}</b></div><div class="lg"><b style="font-size:10px">Obras por situação</b>${so.map(k=>`<div><i style="background:${CR[k]}"></i>${ST[k]}: <b>${co(k)}</b></div>`).join("")}</div></div><div class="box"><b style="font-size:10px">Avanço médio das obras</b><div class="big">${media}%</div><div style="display:flex;margin-top:5px">${pb(media)}</div></div></div>`);
  // gráfico 1: obras por tipo de etapa
  const Ef=E.filter(x=>fase==="Todas"||x.fase===fase),tipos=[...new Set(Ef.map(x=>x.tipo))].sort((a,b)=>(a==="Outros")-(b==="Outros")||Ef.filter(x=>x.tipo===b).length-Ef.filter(x=>x.tipo===a).length);
  const leg=["concluida","em_andamento","pendente","atrasada"].map(k=>`<span><i style="background:${CR[k]}"></i>${ST[k]}</span>`).join("");
  add(`<h2>Obras por tipo de etapa <small>fase: ${fase} · cada etiqueta é uma obra, a cor mostra a situação da etapa</small></h2><div class="leg">${leg}</div>`,true);
  tipos.forEach(t=>{const ex=Ef.filter(x=>x.tipo===t),ob=[...new Set(ex.map(x=>x.o))];
   const chips=ob.map(o=>{const es=ex.filter(x=>x.o===o).map(x=>ef(x.s,x.f));const s=es.every(v=>v==="concluida")?"concluida":es.includes("atrasada")?"atrasada":es.includes("em_andamento")?"em_andamento":"pendente";return`<span class="chip" style="border-color:${CR[s]}">${esc(nome(o))}</span>`}).join("");
   add(`<div class="tp"><div class="th"><b>${t}</b><span>${ob.length} obra(s) · ${ex.length} etapa(s)</span></div><div class="chips">${chips}</div></div>`)});
  // gráfico 2: andamento por tipo
  const ks=["concluida","em_andamento","pendente","atrasada"],seg=(n,t,k)=>n?`<i style="width:${n/t*100}%;background:${CR[k]}">${n}</i>`:"";
  add(`<h2>Andamento por tipo de etapa <small>fase: ${fase} · quantas etapas estão prontas e quantas em andamento</small></h2><div class="leg">${leg}</div>`+tipos.map(t=>{const ex=Ef.filter(x=>x.tipo===t),c=Object.fromEntries(ks.map(k=>[k,ex.filter(x=>ef(x.s,x.f)===k||(k==="pendente"&&x.s==="pausada")&&ef(x.s,x.f)!=="atrasada").length]));
   return`<div class="sr"><b>${t}</b><div class="t">${ks.map(k=>seg(c[k],ex.length,k)).join("")}</div><small><b>${c.concluida}</b> ${c.concluida===1?"pronta":"prontas"} · <b>${c.em_andamento}</b> em andamento<br>${Math.round(c.concluida/ex.length*100)}% concluído (${ex.length} etapas)</small></div>`}).join(""));
  const al=[],A=(c,t)=>al.push(`<div class="al ${c}">${t}</div>`);
  L.filter(o=>ef(o.s,o.f)==="atrasada").forEach(o=>A("r",`<b>Obra atrasada:</b> ${esc(nome(o))}, previsão ${fd(o.f)}`));
  E.filter(x=>ef(x.s,x.f)==="atrasada").forEach(x=>A("r",`<b>Etapa vencida:</b> ${esc(nomeE(x.n))} (${esc(nome(x.o))}), venceu em ${fd(x.f)}`));
  const em7=new Date(Date.now()+7*864e5).toISOString().slice(0,10);E.filter(x=>x.s!=="concluida"&&x.f>=HOJE&&x.f<=em7).slice(0,6).forEach(x=>A("a",`<b>Vence em breve:</b> ${esc(nomeE(x.n))} (${esc(nome(x.o))}), ${fd(x.f)}`));
  const sr=E.filter(x=>!x.r&&x.s!=="concluida").length;if(sr)A("a",`<b>${sr} etapa(s) em aberto sem responsável.</b>`);
  add(`<h2>Alertas e pendências</h2>${al.slice(0,8).join("")||'<div class="al v">Nenhum alerta no momento.</div>'}`);
 }
 if($("#o-det").checked&&L.length){add(`<h2>Detalhamento das obras <small>${L.length} obra(s)</small></h2>`,true);
  const obs=$("#o-obs").checked;
  L.forEach((o,i)=>{const p=prog(o);add(`<div class="ob"><div class="oh"><b>${i+1}. ${esc(nome(o))}</b>${bd(ef(o.s,o.f))}<div class="pg">${pb(p)}${p}%</div></div><div class="os">${esc(o.c||"—")} · ${esc(o.e||"sem endereço")} · ${fd(o.i)} a ${fd(o.f)} · Resp.: ${esc(resp(o))}</div>
   <table><colgroup><col style="width:20px"><col style="width:${obs?"23%":"34%"}"><col style="width:${obs?"10%":"16%"}"><col style="width:58px"><col style="width:58px"><col style="width:34px"><col style="width:82px">${obs?"<col>":""}</colgroup><thead><tr><th>Nº</th><th>Etapa</th><th>Responsável</th><th>Início</th><th>Término</th><th>%</th><th>Situação</th>${obs?"<th>Observações</th>":""}</tr></thead><tbody>${o.et.map((e,k)=>`<tr><td>${k+1}</td><td><b>${esc(nomeE(e[0]))}</b></td><td>${esc(e[1]||"—")}</td><td>${fd(e[2])}</td><td>${fd(e[3])}</td><td>${e[4]}%</td><td>${bd(ef(e[5],e[3]))}</td>${obs?`<td>${esc(e[6])}</td>`:""}</tr>`).join("")||`<tr><td colspan="8" style="color:#667085">Nenhuma etapa cadastrada.</td></tr>`}</tbody></table></div>`)})}
 return{B_,n:L.length}}
// ---- paginação em folhas A4
function render(){lista();const pv=$("#pv");pv.innerHTML="";const {B_,n}=blocos(),folhas=[];
 const nova=()=>{const s=document.createElement("section");s.className="sheet";s.innerHTML=`<div class="hd"><img src="${B}" alt="Dinâmica Elétrica"><div class="t"><b>Relatório de Obras</b><span>Emitido em ${EMIT} · ${n} obra(s) selecionada(s)</span></div></div><div class="sb"></div><div class="ft"><span>Dinâmica Elétrica · Gestão de Obras</span><span></span></div>`;pv.appendChild(s);folhas.push(s);return s.querySelector(".sb")};
 if(!B_.length){nova().innerHTML='<p style="padding:20px;color:#667085">Nada selecionado. Marque ao menos uma obra e uma seção (Dashboard ou Detalhamento).</p>'}
 let sb=null;B_.forEach(b=>{if(!sb)sb=nova();const el=document.createElement("div");el.className="blk"+(b.kw?" kw":"");el.innerHTML=b.h;sb.appendChild(el);
  if(sb.scrollHeight>sb.clientHeight+1&&sb.children.length>1){const mv=[el];sb.removeChild(el);while(sb.lastElementChild&&sb.lastElementChild.classList.contains("kw")){mv.unshift(sb.lastElementChild);sb.removeChild(sb.lastElementChild)}
   sb=nova();mv.forEach(x=>sb.appendChild(x))}});
 folhas.forEach((s,i)=>s.querySelector(".ft span:last-child").textContent=`Página ${i+1} de ${folhas.length}`)}
// ---- exportação para Excel (.xlsx; se a biblioteca não carregar, gera CSV)
$("#b-xls").onclick=()=>{const rows=[["Obra","Cliente","Situação da obra","Progresso (%)","Etapa","Tipo","Fase","Responsável","Início","Término","% etapa","Situação da etapa","Observações"]],res=[["Obra","Cliente","Endereço","Situação","Progresso (%)","Início previsto","Conclusão prevista","Responsáveis","Nº de etapas"]];
 [...sel].sort((a,b)=>a-b).forEach(i=>{const o=D.obras[i];res.push([nome(o),o.c,o.e,ST[ef(o.s,o.f)],prog(o),fd(o.i),fd(o.f),resp(o),o.et.length]);
  (o.et.length?o.et:[["","","","",0,"",""]]).forEach(e=>rows.push([nome(o),o.c,ST[ef(o.s,o.f)],prog(o),nomeE(e[0]),e.tipo||"",e.fase||"",e[1],fd(e[2]),fd(e[3]),e[4],e[5]?ST[ef(e[5],e[3])]:"",e[6]]))});
 if(window.XLSX){const wb=XLSX.utils.book_new(),w1=XLSX.utils.aoa_to_sheet(rows),w2=XLSX.utils.aoa_to_sheet(res);w1["!cols"]=[28,22,16,12,28,14,11,14,11,11,8,16,40].map(w=>({wch:w}));w2["!cols"]=[28,22,30,16,12,14,16,26,10].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,w2,"Obras");XLSX.utils.book_append_sheet(wb,w1,"Etapas");XLSX.writeFile(wb,`relatorio-obras-${HOJE}.xlsx`);return}
 const q=v=>`"${String(v==null?"":v).replace(/"/g,'""')}"`;baixar(`relatorio-obras-${HOJE}.csv`,"\ufeff"+rows.map(r=>r.map(q).join(";")).join("\r\n"),"text/csv")};
render();

})();
