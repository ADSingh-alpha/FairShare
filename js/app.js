document.addEventListener("DOMContentLoaded",()=>{
  if(!Storage.ensureAuth()) return;
  const data=()=>Storage.get();
  let chartInstances=[];

  const navItems=[
    ["dashboard","▦","Dashboard"],["groups","◫","My Groups"],["expenses","≋","All Expenses"],
    ["balances","⇄","Balances"],["settlements","₹","Settle Up"],["analytics","⌁","Analytics"],
    ["history","◷","Transaction History"],["profile","◉","Profile"],["settings","⚙","Settings"]
  ];
  const titles={dashboard:["Overview","Dashboard"],groups:["Manage","My Groups"],expenses:["Records","All Expenses"],balances:["Settlement","Balances"],settlements:["Payments","Settle Up"],analytics:["Insights","Analytics"],history:["Activity","Transaction History"],profile:["Account","Profile"],settings:["Preferences","Settings"]};
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=(amount,currency="INR")=>currency==="INR"?`₹${Number(amount||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`:Number(amount||0).toLocaleString(undefined,{style:"currency",currency});
  const userName=id=>data().users.find(u=>u.id===id)?.name||"Unknown";
  const groupName=id=>data().groups.find(g=>g.id===id)?.name||"Unknown";
  const avatar=name=>`<span class="avatar">${escapeHtml((name||"?").charAt(0).toUpperCase())}</span>`;

  function toast(message){
    const el=document.createElement("div"); el.className="toast"; el.textContent=message; $("toastStack").append(el);
    setTimeout(()=>el.remove(),3000);
  }
  function openModal(title,body){
    $("modalTitle").textContent=title;$("modalBody").innerHTML=body;$("modalBackdrop").hidden=false;
  }
  function closeModal(){ $("modalBackdrop").hidden=true; }
  $("modalClose").onclick=closeModal;$("modalBackdrop").onclick=e=>{if(e.target===e.currentTarget)closeModal();};
  $("menuBtn").onclick=()=>{$("sidebar").classList.add("open")};
  $("sidebarClose").onclick=()=>{$("sidebar").classList.remove("open")};
  $("logoutBtn").onclick=()=>{const d=data();d.sessionUserId=null;Storage.set(d);location.href="login.html"};
  $("themeBtn").onclick=()=>{const d=data();d.settings.theme=d.settings.theme==="dark"?"light":"dark";Storage.set(d);document.body.classList.toggle("dark",d.settings.theme==="dark");};

  function buildNav(){
    $("sideNav").innerHTML=navItems.map(([key,icon,label])=>`<button class="nav-item" data-route="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join("");
    $("sideNav").querySelectorAll("[data-route]").forEach(btn=>btn.onclick=()=>navigate(btn.dataset.route));
  }
  function navigate(route){
    route=route||"dashboard"; if(!titles[route])route="dashboard";
    location.hash=route; $("sidebar").classList.remove("open");
    document.querySelectorAll("[data-route]").forEach(b=>b.classList.toggle("active",b.dataset.route===route));
    $("pageTitle").textContent=titles[route][1];$("topEyebrow").textContent=titles[route][0];
    chartInstances.forEach(c=>c.destroy());chartInstances=[];
    const renderers={dashboard:renderDashboard,groups:renderGroups,expenses:renderExpenses,balances:renderBalances,settlements:renderSettlements,analytics:renderAnalytics,history:renderHistory,profile:renderProfile,settings:renderSettings};
    renderers[route]();
  }

  function setTopUser(){
    const u=Storage.currentUser(); if(!u)return;
    $("topName").textContent=u.name;$("topAvatar").textContent=u.name.charAt(0).toUpperCase();
  }

  function renderDashboard(){
    const d=data(),u=Storage.currentUser();
    const total=d.expenses.reduce((sum,e)=>sum+Number(e.amount),0);
    const paid=d.expenses.filter(e=>e.paidBy===u.id).reduce((sum,e)=>sum+Number(e.amount),0);
    let owe=0,owed=0;
    d.groups.forEach(g=>Calculations.groupBalances(g.id).forEach(b=>{
      if(b.memberId===u.id&&b.balance<0) owe+=-b.balance;
      if(b.memberId===u.id&&b.balance>0) owed+=b.balance;
    }));
    $("mainContent").innerHTML=`
      <div class="page-grid">
        <div class="stats-grid">
          ${statCard("Total expenses","₹",total,"Across all groups","cart")}
          ${statCard("You paid","₹",paid,"Your contributions","wallet")}
          ${statCard("You owe","₹",owe,"Outstanding","arrow")}
          ${statCard("Active groups","",d.groups.length,"Shared spaces","groups")}
        </div>
        <div class="section-grid">
          <section class="card panel"><div class="panel-header"><h2>Recent transactions</h2><button class="btn btn-secondary btn-small" data-route="expenses">View all</button></div>${expenseTable(d.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5))}</section>
          <section class="card panel"><div class="panel-header"><h2>Quick actions</h2></div><div class="quick-actions">
            ${quickAction("＋","Add expense","expense")}
            ${quickAction("◫","Create group","group")}
            ${quickAction("⇄","Settle up","settlement")}
            ${quickAction("⌁","View reports","reports")}
          </div></section>
        </div>
      </div>`;
    $("mainContent").querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>navigate(b.dataset.route));
    document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>quickActionHandler(b.dataset.action));
    bindExpenseActions();
  }
  function statCard(label,icon,value,sublabel,kind){
    return `<article class="card stat-card"><div class="stat-head"><span>${label}</span><span class="stat-icon">${kind==="cart"?"▱":kind==="wallet"?"◈":kind==="arrow"?"↗":"◫"}</span></div><strong>${icon}${typeof value==="number"?value.toLocaleString("en-IN",{minimumFractionDigits:icon==="₹"?2:0,maximumFractionDigits:2}):value}</strong><small>${sublabel}</small></article>`;
  }
  function quickAction(icon,label,action){return `<button class="quick-action" data-action="${action}"><span>${icon}</span><strong>${label}</strong></button>`}
  function quickActionHandler(action){
    if(action==="expense")openExpenseModal();
    if(action==="group")openGroupModal();
    if(action==="settlement")openSettlementModal();
    if(action==="reports")navigate("analytics");
  }
  function expenseTable(expenses){
    if(!expenses.length)return`<div class="empty-state"><strong>No transactions yet</strong>Add an expense to get started.</div>`;
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Expense</th><th>Paid by</th><th>Group</th><th>Date</th><th>Amount</th><th></th></tr></thead><tbody>${expenses.map(e=>`<tr><td><strong>${escapeHtml(e.title)}</strong><br><span class="badge">${escapeHtml(e.category)}</span></td><td>${escapeHtml(userName(e.paidBy))}</td><td>${escapeHtml(groupName(e.groupId))}</td><td>${formatDate(e.date)}</td><td><strong>${money(e.amount)}</strong></td><td><button class="btn btn-secondary btn-small" data-edit-expense="${e.id}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function bindExpenseActions(){
    document.querySelectorAll("[data-edit-expense]").forEach(b=>b.onclick=()=>openExpenseModal(b.dataset.editExpense));
  }
  function formatDate(date){return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}

  function renderGroups(){
    const d=data();
    $("mainContent").innerHTML=`<div class="toolbar"><div></div><button class="btn btn-primary" id="newGroupBtn">＋ Create group</button></div><div class="group-grid">${d.groups.map(g=>{
      const total=d.expenses.filter(e=>e.groupId===g.id).reduce((s,e)=>s+Number(e.amount),0);
      return `<article class="card group-card"><div class="group-card-head"><span class="badge green">${g.memberIds.length} members</span><button class="icon-btn" data-edit-group="${g.id}">•••</button></div><h3>${escapeHtml(g.name)}</h3><p>${escapeHtml(g.description||"No description")}</p><div class="member-row"><span>Total expenses</span><strong>${money(total)}</strong></div><div style="display:flex;margin-top:12px">${g.memberIds.slice(0,4).map(id=>avatar(userName(id))).join("")}</div></article>`;
    }).join("")}</div>`;
    $("newGroupBtn").onclick=()=>openGroupModal();
    document.querySelectorAll("[data-edit-group]").forEach(b=>b.onclick=()=>openGroupModal(b.dataset.editGroup));
  }
  function openGroupModal(groupId){
    const d=data(),g=d.groups.find(x=>x.id===groupId);
    const isEdit=!!g;
    const memberChecks=d.users.map(u=>`<label class="member-row"><span class="person">${avatar(u.name)}<span>${escapeHtml(u.name)}</span></span><input type="checkbox" value="${u.id}" ${g?.memberIds.includes(u.id)?"checked":""}></label>`).join("");
    openModal(isEdit?"Edit group":"Create group",`<form id="groupForm"><div class="form-grid"><label class="field"><span>Group name</span><input id="groupName" value="${escapeHtml(g?.name||"")}" required></label><label class="field"><span>Description</span><input id="groupDescription" value="${escapeHtml(g?.description||"")}"></label><div class="field full"><span>Members</span><div class="card" style="box-shadow:none">${memberChecks}</div></div></div><p class="form-error" id="groupError"></p><div style="display:flex;justify-content:flex-end;gap:8px">${isEdit?`<button type="button" class="btn btn-danger" id="deleteGroupBtn">Delete</button>`:""}<button type="submit" class="btn btn-primary">${isEdit?"Save changes":"Create group"}</button></div></form>`);
    $("groupForm").onsubmit=e=>{
      e.preventDefault();const ids=[...document.querySelectorAll("#groupForm input[type=checkbox]:checked")].map(x=>x.value);const name=$("groupName").value.trim();
      if(!name||ids.length<2){$("groupError").textContent="Enter a name and select at least two members.";return;}
      if(isEdit){Object.assign(g,{name,description:$("groupDescription").value.trim(),memberIds:ids});toast("Group updated");}
      else{d.groups.push({id:Storage.uid("group"),name,description:$("groupDescription").value.trim(),ownerId:Storage.currentUser().id,memberIds:ids,createdAt:new Date().toISOString().slice(0,10)});toast("Group created");}
      Storage.set(d);closeModal();renderGroups();
    };
    if(isEdit)$("deleteGroupBtn").onclick=()=>{if(confirm("Delete this group and its expenses?")){d.groups=d.groups.filter(x=>x.id!==groupId);d.expenses=d.expenses.filter(e=>e.groupId!==groupId);d.settlements=d.settlements.filter(s=>s.groupId!==groupId);Storage.set(d);closeModal();renderGroups();toast("Group deleted");}};
  }

  function renderExpenses(){
    const d=data();
    $("mainContent").innerHTML=`<div class="toolbar"><input class="search-input" id="expenseSearch" placeholder="Search expenses..."><div style="display:flex;gap:8px"><button class="btn btn-secondary" id="exportBtn">Export CSV</button><button class="btn btn-primary" id="addExpenseBtn">＋ Add expense</button></div></div><section class="card panel">${expenseTable(d.expenses)}</section>`;
    $("addExpenseBtn").onclick=()=>openExpenseModal();
    $("exportBtn").onclick=exportCSV;
    bindExpenseActions();
    $("expenseSearch").oninput=e=>{const q=e.target.value.toLowerCase();const filtered=d.expenses.filter(x=>[x.title,x.category,groupName(x.groupId),userName(x.paidBy)].join(" ").toLowerCase().includes(q));document.querySelector("#mainContent .panel").innerHTML=expenseTable(filtered);bindExpenseActions()};
  }
  function openExpenseModal(expenseId){
    const d=data(),e=d.expenses.find(x=>x.id===expenseId),isEdit=!!e;
    openModal(isEdit?"Edit expense":"Add expense",`<form id="expenseForm"><div class="form-grid">
      <label class="field"><span>Expense title</span><input id="expenseTitle" value="${escapeHtml(e?.title||"")}" required></label>
      <label class="field"><span>Amount</span><input id="expenseAmount" type="number" min=".01" step=".01" value="${e?.amount||""}" required></label>
      <label class="field"><span>Paid by</span><select id="expensePaidBy">${d.users.map(u=>`<option value="${u.id}" ${e?.paidBy===u.id?"selected":""}>${escapeHtml(u.name)}</option>`).join("")}</select></label>
      <label class="field"><span>Group</span><select id="expenseGroup">${d.groups.map(g=>`<option value="${g.id}" ${e?.groupId===g.id?"selected":""}>${escapeHtml(g.name)}</option>`).join("")}</select></label>
      <label class="field"><span>Category</span><select id="expenseCategory">${["Groceries","Rent","Electricity","Internet","Food & Dining","Transportation","Entertainment","Shopping","Other"].map(c=>`<option ${e?.category===c?"selected":""}>${c}</option>`).join("")}</select></label>
      <label class="field"><span>Date</span><input id="expenseDate" type="date" value="${e?.date||new Date().toISOString().slice(0,10)}" required></label>
      <label class="field full"><span>Description</span><textarea id="expenseDescription">${escapeHtml(e?.description||"")}</textarea></label>
      <label class="field"><span>Split method</span><select id="splitMethod"><option value="equal" ${e?.method==="equal"?"selected":""}>Equal split</option><option value="percentage" ${e?.method==="percentage"?"selected":""}>Percentage split</option><option value="custom" ${e?.method==="custom"?"selected":""}>Custom split</option></select></label>
      <div class="field"><span>Share preview</span><div id="splitPreview" class="split-list"></div></div>
      <p class="form-error field full" id="expenseError"></p>
    </div><div style="display:flex;justify-content:flex-end;gap:8px">${isEdit?`<button type="button" class="btn btn-danger" id="deleteExpenseBtn">Delete</button>`:""}<button type="submit" class="btn btn-primary">${isEdit?"Save changes":"Add expense"}</button></div></form>`);
    const updatePreview=()=>{
      const g=d.groups.find(x=>x.id===$("expenseGroup").value)||d.groups[0];if(!g)return;
      const amount=Calculations.round(Number($("expenseAmount").value||0));const method=$("splitMethod").value;
      $("splitPreview").innerHTML=g.memberIds.map(id=>{
        let value=0;if(method==="equal"&&amount)value=Calculations.round(amount/g.memberIds.length);
        if(method==="percentage"){const s=e?.splits?.find(x=>x.memberId===id);value=s?Calculations.round(s.amount/amount*100):Calculations.round(100/g.memberIds.length);}
        if(method==="custom"){value=e?.splits?.find(x=>x.memberId===id)?.amount||0;}
        const suffix=method==="percentage"?"%":"₹";
        return `<div class="split-row"><label>${escapeHtml(userName(id))}</label><input type="number" min="0" step=".01" data-member="${id}" data-split="${method}" value="${value}" ${method==="equal"?"disabled":""}></div>`;
      }).join("");
    };
    ["expenseGroup","expenseAmount","splitMethod"].forEach(id=>{$(id).onchange=updatePreview;$((id)).oninput=updatePreview});
    updatePreview();
    $("expenseForm").onsubmit=eSubmit=>{
      eSubmit.preventDefault();const g=d.groups.find(x=>x.id===$("expenseGroup").value);const amount=Calculations.round(Number($("expenseAmount").value));
      if(!g||amount<=0){$("expenseError").textContent="Enter a valid amount and select a group.";return;}
      const method=$("splitMethod").value,ids=g.memberIds;let splits;
      if(method==="equal")splits=Calculations.equalSplit(amount,ids);
      if(method==="percentage"){const percentages=Object.fromEntries([...document.querySelectorAll("[data-split=percentage]")].map(x=>[x.dataset.member,Number(x.value||0)]));if(Calculations.round(Object.values(percentages).reduce((a,b)=>a+b,0))!==100){$("expenseError").textContent="Percentages must total exactly 100%.";return;}splits=Calculations.percentageSplit(amount,ids,percentages);}
      if(method==="custom"){const amounts=Object.fromEntries([...document.querySelectorAll("[data-split=custom]")].map(x=>[x.dataset.member,Number(x.value||0)]));splits=Calculations.customSplit(amount,ids,amounts);if(!Calculations.validateSplit(amount,splits)){ $("expenseError").textContent="Custom shares must equal the expense amount.";return;}}
      const record={id:isEdit?e.id:Storage.uid("expense"),title:$("expenseTitle").value.trim(),amount,paidBy:$("expensePaidBy").value,groupId:g.id,category:$("expenseCategory").value,date:$("expenseDate").value,description:$("expenseDescription").value.trim(),method,memberIds:ids,splits,createdAt:e?.createdAt||new Date().toISOString()};
      if(!record.title||!record.date){$("expenseError").textContent="Expense title and date are required.";return;}
      if(isEdit)d.expenses[d.expenses.findIndex(x=>x.id===e.id)]=record;else d.expenses.push(record);d.activity.unshift({id:Storage.uid("activity"),text:`${Storage.currentUser().name} ${isEdit?"updated":"added"} ${record.title}`,date:new Date().toISOString().slice(0,10)});
      Storage.set(d);closeModal();navigate(location.hash.slice(1)||"expenses");toast(isEdit?"Expense updated":"Expense added");
    };
    if(isEdit)$("deleteExpenseBtn").onclick=()=>{if(confirm("Delete this expense?")){d.expenses=d.expenses.filter(x=>x.id!==expenseId);Storage.set(d);closeModal();navigate("expenses");toast("Expense deleted");}};
  }

  function renderBalances(){
    const d=data(),u=Storage.currentUser();
    $("mainContent").innerHTML=`<div class="page-grid">${d.groups.map(g=>{
      const balances=Calculations.groupBalances(g.id),suggestions=Calculations.simplifyDebts(balances);
      return `<section class="card panel"><div class="panel-header"><h2>${escapeHtml(g.name)}</h2><span class="badge">${money(d.expenses.filter(e=>e.groupId===g.id).reduce((s,e)=>s+Number(e.amount),0))} total</span></div>
        ${balances.map(b=>`<div class="balance-row"><span class="person">${avatar(userName(b.memberId))}<strong>${escapeHtml(userName(b.memberId))}${b.memberId===u.id?" (You)":""}</strong></span><strong class="${b.balance>0?"positive":b.balance<0?"negative":""}">${b.balance>0?"Is owed":b.balance<0?"Owes":"Settled"} ${b.balance!==0?money(Math.abs(b.balance)):""}</strong></div>`).join("")}
        <div class="panel-header" style="margin-top:18px"><h2>Suggested settlements</h2></div>${suggestions.length?suggestions.map(s=>`<div class="transaction-row"><span><strong>${escapeHtml(userName(s.payerId))}</strong> pays <strong>${escapeHtml(userName(s.receiverId))}</strong></span><strong class="positive">${money(s.amount)}</strong></div>`).join(""):`<div class="empty-state" style="padding:16px"><strong>Everyone is settled up</strong></div>`}</section>`;
    }).join("")}</div>`;
  }
  function renderSettlements(){
    const d=data();
    $("mainContent").innerHTML=`<div class="toolbar"><div></div><button class="btn btn-primary" id="recordSettlementBtn">＋ Record payment</button></div><section class="card panel"><div class="panel-header"><h2>Settlement history</h2></div>${d.settlements.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Payer</th><th>Receiver</th><th>Group</th><th>Date</th><th>Amount</th></tr></thead><tbody>${d.settlements.slice().reverse().map(s=>`<tr><td>${escapeHtml(userName(s.payerId))}</td><td>${escapeHtml(userName(s.receiverId))}</td><td>${escapeHtml(groupName(s.groupId))}</td><td>${formatDate(s.date)}</td><td><strong>${money(s.amount)}</strong></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><strong>No settlements recorded</strong>Record a payment when a balance is paid.</div>`}</section>`;
    $("recordSettlementBtn").onclick=()=>openSettlementModal();
  }
  function openSettlementModal(){
    const d=data();if(!d.groups.length){toast("Create a group first");return;}
    const g=d.groups[0];
    openModal("Record settlement",`<form id="settlementForm"><div class="form-grid"><label class="field"><span>Group</span><select id="settlementGroup">${d.groups.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("")}</select></label><label class="field"><span>Payment date</span><input type="date" id="settlementDate" value="${new Date().toISOString().slice(0,10)}"></label><label class="field"><span>Payer</span><select id="settlementPayer"></select></label><label class="field"><span>Receiver</span><select id="settlementReceiver"></select></label><label class="field full"><span>Amount</span><input type="number" id="settlementAmount" min=".01" step=".01"></label><label class="field full"><span>Note</span><input id="settlementNote" placeholder="Optional note"></label></div><p class="form-error" id="settlementError"></p><div style="display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">Record payment</button></div></form>`);
    const updateMembers=()=>{const group=d.groups.find(x=>x.id===$("settlementGroup").value);const options=group.memberIds.map(id=>`<option value="${id}">${escapeHtml(userName(id))}</option>`).join("");$("settlementPayer").innerHTML=options;$("settlementReceiver").innerHTML=options;if($("settlementReceiver").options.length>1)$("settlementReceiver").selectedIndex=1;};
    $("settlementGroup").onchange=updateMembers;updateMembers();
    $("settlementForm").onsubmit=e=>{
      e.preventDefault();const amount=Calculations.round(Number($("settlementAmount").value));const payer=$("settlementPayer").value,receiver=$("settlementReceiver").value,groupId=$("settlementGroup").value;
      if(amount<=0||payer===receiver){$("settlementError").textContent="Enter a valid amount and select different people.";return;}
      d.settlements.push({id:Storage.uid("settlement"),groupId,payerId:payer,receiverId:receiver,amount,date:$("settlementDate").value,note:$("settlementNote").value.trim()});
      Storage.set(d);closeModal();renderSettlements();toast("Payment recorded");
    };
  }

  function renderHistory(){
    const d=data();
    $("mainContent").innerHTML=`<div class="toolbar"><input class="search-input" id="historySearch" placeholder="Search title, category or group"><select class="search-input" id="historyGroup"><option value="">All groups</option>${d.groups.map(g=>`<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}</select></div><section class="card panel">${expenseTable(d.expenses)}</section>`;
    bindExpenseActions();
    const filter=()=>{const q=$("historySearch").value.toLowerCase(),gid=$("historyGroup").value;const f=d.expenses.filter(e=>(!gid||e.groupId===gid)&&[e.title,e.category,groupName(e.groupId)].join(" ").toLowerCase().includes(q));document.querySelector("#mainContent .panel").innerHTML=expenseTable(f);bindExpenseActions()};
    $("historySearch").oninput=filter;$("historyGroup").onchange=filter;
  }
  function renderAnalytics(){
    const d=data();
    $("mainContent").innerHTML=`<div class="toolbar"><select class="search-input" id="analyticsRange"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option></select></div><div class="section-grid"><section class="card panel"><div class="panel-header"><h2>Spending overview</h2></div><div class="chart-wrap"><canvas id="monthlyChart"></canvas></div></section><section class="card panel"><div class="panel-header"><h2>By category</h2></div><div class="chart-wrap"><canvas id="categoryChart"></canvas></div></section></div>`;
    const monthly={};d.expenses.forEach(e=>{const key=e.date.slice(0,7);monthly[key]=(monthly[key]||0)+Number(e.amount)});
    const keys=Object.keys(monthly).sort();const category={};d.expenses.forEach(e=>category[e.category]=(category[e.category]||0)+Number(e.amount));
    chartInstances.push(new Chart($("monthlyChart"),{type:"line",data:{labels:keys.map(k=>new Date(k+"-01").toLocaleDateString("en-IN",{month:"short"})),datasets:[{label:"Expenses",data:keys.map(k=>monthly[k]),borderColor:"#1fb881",backgroundColor:"rgba(31,184,129,.12)",tension:.35,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}}));
    chartInstances.push(new Chart($("categoryChart"),{type:"doughnut",data:{labels:Object.keys(category),datasets:[{data:Object.values(category),backgroundColor:["#1fb881","#10243e","#edb84a","#60a5fa","#dc5a67","#8b6ed1"]}]},options:{responsive:true,maintainAspectRatio:false}}));
  }
  function renderProfile(){
    const d=data(),u=Storage.currentUser();
    $("mainContent").innerHTML=`<section class="card panel" style="max-width:680px"><div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">${avatar(u.name).replace('class="avatar"','class="avatar" style="width:58px;height:58px;font-size:20px"')}<div><h2 style="margin:0">${escapeHtml(u.name)}</h2><span style="color:var(--muted)">${escapeHtml(u.email)}</span></div></div><form id="profileForm"><div class="form-grid"><label class="field"><span>Name</span><input id="profileName" value="${escapeHtml(u.name)}"></label><label class="field"><span>Email</span><input id="profileEmail" type="email" value="${escapeHtml(u.email)}"></label><label class="field full"><span>New password</span><input id="profilePassword" type="password" placeholder="Leave blank to keep existing password"></label></div><p class="form-error" id="profileError"></p><button class="btn btn-primary" type="submit">Save profile</button></form></section>`;
    $("profileForm").onsubmit=e=>{e.preventDefault();const name=$("profileName").value.trim(),email=$("profileEmail").value.trim().toLowerCase(),password=$("profilePassword").value;if(!name||!email.includes("@")){$("profileError").textContent="Enter a valid name and email.";return;}if(d.users.some(x=>x.id!==u.id&&x.email.toLowerCase()===email)){ $("profileError").textContent="That email is already in use.";return;}Object.assign(u,{name,email,password:password||u.password,currency:d.settings.currency});Storage.set(d);setTopUser();toast("Profile updated");};
  }
  function renderSettings(){
    const d=data();
    $("mainContent").innerHTML=`<section class="card panel" style="max-width:680px"><div class="panel-header"><h2>Preferences</h2></div><form id="settingsForm"><div class="form-grid"><label class="field"><span>Currency</span><select id="currencySetting"><option value="INR" ${d.settings.currency==="INR"?"selected":""}>Indian Rupee (₹)</option><option value="USD" ${d.settings.currency==="USD"?"selected":""}>US Dollar ($)</option></select></label><label class="field"><span>Theme</span><select id="themeSetting"><option value="light" ${d.settings.theme==="light"?"selected":""}>Light</option><option value="dark" ${d.settings.theme==="dark"?"selected":""}>Dark</option></select></label></div><button class="btn btn-primary" type="submit" style="margin-top:16px">Save settings</button></form></section>`;
    $("settingsForm").onsubmit=e=>{e.preventDefault();d.settings.currency=$("currencySetting").value;d.settings.theme=$("themeSetting").value;Storage.set(d);document.body.classList.toggle("dark",d.settings.theme==="dark");toast("Settings saved");};
  }
  function exportCSV(){
    const d=data(),rows=[["Title","Paid By","Group","Category","Amount","Date"],...d.expenses.map(e=>[e.title,userName(e.paidBy),groupName(e.groupId),e.category,e.amount,e.date])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download="splitnest-expenses.csv";a.click();URL.revokeObjectURL(url);toast("CSV exported");
  }

  buildNav();setTopUser();document.body.classList.toggle("dark",data().settings.theme==="dark");
  window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)));
  navigate(location.hash.slice(1)||"dashboard");
});
