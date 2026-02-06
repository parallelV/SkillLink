const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmtPay = (amt, type) => (amt?`₱${Number(amt).toLocaleString()}`:'—') + (type?` / ${type}`:'');

const saved = new Set(JSON.parse(localStorage.getItem('savedJobs')||'[]'));
const localPosts = JSON.parse(localStorage.getItem('employerPosts')||'[]');

const state = {
  q:'', loc:'', cat:'',
  trades: new Set(), paytype:'', exp:'',
  shifts: new Set(), minPay:'', maxPay:'',
  quick: {nearme:false, withlodging:false, withtools:false, urgent:false},
  sortBy:'newest'
};

const defaultJobs = [
  { id:1, title:"Driver (Delivery Van)", company:"FastDrop Logistics", trade:"Driving", location:"Caloocan, Metro Manila",
    payAmount:900, payType:"Daily", experience:"Entry", shift:"Day", badges:["Urgent","With Benefits"], toolsProvided:true, lodging:false, urgent:true,
    posted:"2026-02-03", desc:"Deliver goods in Metro Manila. Must have valid license (RC 1/2)."
  },
  { id:2, title:"Welder (SMAW)", company:"NorthSteel Works", trade:"Welding", location:"Valenzuela, Metro Manila",
    payAmount:1200, payType:"Daily", experience:"Mid", shift:"Rotational", badges:["PPE Provided","OT Pay"], toolsProvided:true, lodging:false, urgent:false,
    posted:"2026-01-31", desc:"SMAW fabrication & repair. Weld test onsite."
  },
  { id:3, title:"Electrician", company:"Arko Build Inc.", trade:"Electrical", location:"Quezon City, Metro Manila",
    payAmount:18000, payType:"Monthly", experience:"Mid", shift:"Day", badges:["With Lodging","Project-Based"], toolsProvided:false, lodging:true, urgent:true,
    posted:"2026-02-02", desc:"Site wiring, panel install, troubleshooting. NC II preferred."
  },
  { id:4, title:"Mason / Laborer", company:"SolidBase Construction", trade:"Construction", location:"Cebu City, Cebu",
    payAmount:700, payType:"Daily", experience:"Entry", shift:"Day", badges:["Meal Allowance"], toolsProvided:false, lodging:false, urgent:false,
    posted:"2026-01-29", desc:"Block laying, plastering, general site works."
  },
  { id:5, title:"Housekeeper", company:"Bayview Residences", trade:"Housekeeping", location:"Pasay, Metro Manila",
    payAmount:15000, payType:"Monthly", experience:"Entry", shift:"Flexible", badges:["Female Friendly","HMO"], toolsProvided:true, lodging:false, urgent:false,
    posted:"2026-02-01", desc:"Cleaning, linens, common areas. Training provided."
  },
  { id:6, title:"Plumber", company:"FlowRight Services", trade:"Plumbing", location:"Davao City, Davao del Sur",
    payAmount:1100, payType:"Daily", experience:"Mid", shift:"Day", badges:["Tools Provided"], toolsProvided:true, lodging:false, urgent:false,
    posted:"2026-01-28", desc:"Pipe install, leak repair, fixture fitting. NC II a plus."
  },
  { id:7, title:"Auto Mechanic", company:"TorqueMaster Garage", trade:"Mechanic", location:"Makati, Metro Manila",
    payAmount:20000, payType:"Monthly", experience:"Senior", shift:"Day", badges:["Commission","With Benefits"], toolsProvided:false, lodging:false, urgent:true,
    posted:"2026-02-04", desc:"Engine diagnostics, suspension, brakes. At least 5y exp."
  },
  { id:8, title:"Carpenter", company:"TimberCraft PH", trade:"Carpentry", location:"Baguio, Benguet",
    payAmount:1000, payType:"Daily", experience:"Mid", shift:"Day", badges:["Project-Based"], toolsProvided:false, lodging:true, urgent:false,
    posted:"2026-01-27", desc:"Formworks, finishing carpentry. Accommodation provided."
  },
  { id:9, title:"Security Guard", company:"ShieldWatch Agency", trade:"Security", location:"Taguig, Metro Manila",
    payAmount:750, payType:"Daily", experience:"Entry", shift:"Rotational", badges:["License Required"], toolsProvided:false, lodging:false, urgent:true,
    posted:"2026-02-05", desc:"Post assignments in BGC. Must have valid guard license."
  }
];

function mergedJobs(){
  const startId = Math.max(0,...defaultJobs.map(j=>j.id)) + 1;
  const mappedLocal = localPosts.map((p,i)=>({
    id: startId+i,
    title:p.title, company:p.company, trade:p.trade, location:p.location,
    payAmount:Number(p.payAmount)||0, payType:p.payType, experience:p.experience, shift:p.shift,
    badges:[], toolsProvided:p.flags==='tools', lodging:p.flags==='lodging', urgent:p.flags==='urgent',
    posted:new Date().toISOString().slice(0,10), desc:p.desc||''
  }));
  return [...mappedLocal, ...defaultJobs];
}

function fmtInitialFromQuery(){
  const params = new URLSearchParams(location.search);
  if(params.has('q') && $('#q')) $('#q').value = params.get('q');
  if(params.has('loc') && $('#loc')) $('#loc').value = params.get('loc');
  if(params.has('cat') && $('#cat')) $('#cat').value = params.get('cat');
}

function readSearch(){
  if(!$('#q')) return;
  state.q = $('#q').value.trim();
  state.loc = $('#loc').value.trim();
  state.cat = $('#cat').value.trim();
}
function readFilters(){
  state.trades = new Set($$('input[name="trade"]:checked').map(x=>x.value));
  state.paytype = ($$('input[name="paytype"]:checked')[0]||{}).value || '';
  state.exp = ($$('input[name="exp"]:checked')[0]||{}).value || '';
  state.shifts = new Set($$('input[name="shift"]:checked').map(x=>x.value));
  state.minPay = $('#minPay')?.value ? Number($('#minPay').value) : '';
  state.maxPay = $('#maxPay')?.value ? Number($('#maxPay').value) : '';
}
function matches(job){
  const q = state.q.toLowerCase();
  const inQ = !q || [job.title, job.company, job.trade, job.desc].some(v=>String(v).toLowerCase().includes(q));
  const inLoc = !state.loc || job.location.toLowerCase().includes(state.loc.toLowerCase());
  const inCat = !state.cat || job.trade===state.cat;
  const inTrade = state.trades.size===0 || state.trades.has(job.trade);
  const inPayType = !state.paytype || job.payType===state.paytype;
  const inExp = !state.exp || job.experience===state.exp;
  const inShift = state.shifts.size===0 || state.shifts.has(job.shift);
  const inMin = state.minPay==='' || job.payAmount >= state.minPay;
  const inMax = state.maxPay==='' || job.payAmount <= state.maxPay;
  let okQuick = true;
  if(state.quick.withlodging) okQuick = okQuick && !!job.lodging;
  if(state.quick.withtools) okQuick = okQuick && !!job.toolsProvided;
  if(state.quick.urgent) okQuick = okQuick && !!job.urgent;
  if(state.quick.nearme && state.loc) okQuick = okQuick && job.location.toLowerCase().includes(state.loc.toLowerCase());
  return inQ && inLoc && inCat && inTrade && inPayType && inExp && inShift && inMin && inMax && okQuick;
}
function sortJobs(arr){
  if(state.sortBy==='highestPay'){ return arr.slice().sort((a,b)=> (b.payAmount||0)-(a.payAmount||0)); }
  return arr.slice().sort((a,b)=> new Date(b.posted)-new Date(a.posted));
}
function renderJobs(){
  const cards = $('#cards');
  const empty = $('#empty');
  if(!cards) return;
  const list = sortJobs(mergedJobs().filter(matches));
  $('#count').textContent = `${list.length} job${list.length!==1?'s':''} found`;
  cards.innerHTML = '';
  empty.style.display = list.length? 'none':'block';
  list.forEach(job=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="logo" aria-hidden="true">${job.company.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
      <div>
        <h3>${job.title}</h3>
        <div class="meta">
          <span>${job.company}</span><span>•</span>
          <span>${job.location}</span><span>•</span>
          <span class="pay">${fmtPay(job.payAmount, job.payType)}</span><span>•</span>
          <span>${job.experience}</span><span>•</span>
          <span>${job.shift}</span>
        </div>
        <div class="tags">
          <span class="tag">${job.trade}</span>
          ${job.lodging?`<span class="tag">With Lodging</span>`:''}
          ${job.toolsProvided?`<span class="tag">Tools Provided</span>`:''}
          ${job.urgent?`<span class="tag" style="background:#fff7ed;border-color:#fdba74;color:#9a3412">Urgent</span>`:''}
          ${job.badges?.map?.(b=>`<span class="tag">${b}</span>`).join('')||''}
        </div>
      </div>
      <div class="actions">
        <button class="iconbtn apply" data-id="${job.id}">Apply</button>
        <button class="iconbtn save ${saved.has(job.id)?'active':''}" data-id="${job.id}">${saved.has(job.id)?'Saved':'Save'}</button>
        <button class="iconbtn details" data-id="${job.id}">Details</button>
      </div>`;
    cards.appendChild(el);
  });
  $$('.apply').forEach(btn=>btn.onclick = () => openApply(btn.dataset.id));
  $$('.details').forEach(btn=>btn.onclick = () => {
    const j = mergedJobs().find(x=>x.id==btn.dataset.id);
    alert(j?.desc || 'No description.');
  });
  $$('.save').forEach(btn=>btn.onclick = () => toggleSave(btn));
}
function toggleSave(btn){
  const id = Number(btn.dataset.id);
  if(saved.has(id)){ saved.delete(id);} else { saved.add(id); }
  localStorage.setItem('savedJobs', JSON.stringify(Array.from(saved)));
  btn.classList.toggle('active');
  btn.textContent = saved.has(id)?'Saved':'Save';
}
function openApply(id){
  const job = mergedJobs().find(j=>j.id==id);
  $('#applyJobTitle').textContent = job? job.title : '';
  $('#applyModal').classList.add('on');
  $('#applyModal').dataset.jobId = id;
}
function closeApply(){
  $('#applyModal').classList.remove('on');
  $('#appName').value = ''; $('#appPhone').value = '';
  $('#appEmail').value = ''; $('#appExp').value = ''; $('#appMsg').value = '';
}
function applySubmit(){
  const id = Number($('#applyModal').dataset.jobId);
  const job = mergedJobs().find(j=>j.id===id);
  const name = $('#appName').value.trim();
  const phone = $('#appPhone').value.trim();
  if(!name || !phone){ alert('Please provide your name and phone.'); return; }
  alert(`Application submitted for "${job?.title||'Job'}". Employer will contact you soon.`);
  closeApply();
}

/* Employer demo form handlers */
function employerDemoInit(){
  const save = $('#empSave'); const clear = $('#empClear');
  if(!save) return;
  save.onclick = () => {
    const post = {
      company: $('#empCompany').value.trim(),
      contact: $('#empContact').value.trim(),
      title: $('#empTitle').value.trim(),
      trade: $('#empTrade').value,
      location: $('#empLocation').value.trim(),
      payAmount: $('#empPayAmount').value,
      payType: $('#empPayType').value,
      experience: $('#empExperience').value,
      shift: $('#empShift').value,
      flags: $('#empFlags').value,
      desc: $('#empDesc').value.trim()
    };
    const all = JSON.parse(localStorage.getItem('employerPosts')||'[]');
    all.push(post);
    localStorage.setItem('employerPosts', JSON.stringify(all));
    alert('Saved locally. Check Jobs page.');
  };
  clear.onclick = () => {
    ['empCompany','empContact','empTitle','empLocation','empPayAmount','empDesc'].forEach(id=>$('#'+id).value='');
  };
}

/* Auth modal (mock) */
function authInit(){
  $$('.btn[data-open-auth]').forEach(b => b.onclick = () => {
    $('#authTitle').textContent = b.dataset.openAuth==='login' ? 'Log In' : 'Register';
    $('#authModal').classList.add('on');
  });
  $$('[data-close-auth]').forEach(x => x.onclick = () => $('#authModal').classList.remove('on'));
  $('#authGo') && ($('#authGo').onclick = () => { alert('Auth is mocked in this demo.'); $('#authModal').classList.remove('on'); });
}

/* Jobs page filters */
function filtersInit(){
  if(!$('#applyFilters')) return;
  $('#go').onclick = () => { readSearch(); renderJobs(); };
  ['q','loc','cat'].forEach(id => {
    const el = $('#'+id); if(!el) return;
    el.addEventListener('keydown', e => { if(e.key==='Enter'){ readSearch(); renderJobs(); }});
    el.addEventListener('change', () => { readSearch(); renderJobs(); });
  });
  $('#applyFilters').onclick = () => { readFilters(); renderJobs(); };
  $('#resetFilters').onclick = () => {
    $$('input[name="trade"]').forEach(x=>x.checked=false);
    $$('input[name="paytype"]')[0].checked=true;
    $$('input[name="exp"]')[0].checked=true;
    $$('input[name="shift"]').forEach(x=>x.checked=false);
    $('#minPay').value=''; $('#maxPay').value='';
    state.trades.clear(); state.shifts.clear();
    state.paytype=''; state.exp=''; state.minPay=''; state.maxPay='';
    state.quick = {nearme:false, withlodging:false, withtools:false, urgent:false};
    renderJobs();
  };
  $$('button[data-quick]').forEach(b => b.onclick = () => {
    state.quick[b.dataset.quick] = !state.quick[b.dataset.quick];
    renderJobs();
  });
  $('#sortBy').onchange = e => { state.sortBy = e.target.value; renderJobs(); };

  document.addEventListener('click', (e)=>{
    if(e.target?.matches('[data-close-apply]')) closeApply();
  });
  $('#submitApply') && ($('#submitApply').onclick = applySubmit);
}

function init(){
  const yr = $('#yr'); if(yr) yr.textContent = new Date().getFullYear();
  authInit();
  employerDemoInit();
  fmtInitialFromQuery();
  readSearch();
  filtersInit();
  renderJobs();
}
window.addEventListener('DOMContentLoaded', init);
``