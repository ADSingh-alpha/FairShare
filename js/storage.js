const STORAGE_KEY = "splitnest_data_v1";

const Storage = {
  get() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const seed = this.seed();
    this.set(seed);
    return seed;
  },
  set(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
  uid(prefix = "id") { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; },
  seed() {
    const users = [
      { id:"aman", name:"Aman", email:"aman@example.com", password:"123456", currency:"INR" },
      { id:"rahul", name:"Rahul", email:"rahul@example.com", password:"123456", currency:"INR" },
      { id:"karan", name:"Karan", email:"karan@example.com", password:"123456", currency:"INR" },
      { id:"mohit", name:"Mohit", email:"mohit@example.com", password:"123456", currency:"INR" }
    ];
    const group = { id:"flat302", name:"Flat 302", description:"Shared flat expenses", ownerId:"aman", memberIds:["aman","rahul","karan","mohit"], createdAt:"2026-10-01" };
    const expenseSeed = [
      ["groceries","Groceries",2000,"aman","Groceries","2026-11-20","Weekly grocery shopping"],
      ["electricity","Electricity",1200,"rahul","Electricity","2026-11-18","Monthly electricity bill"],
      ["internet","Internet",800,"karan","Internet","2026-11-15","Broadband plan"],
      ["dinner","Dinner",1000,"mohit","Food & Dining","2026-11-12","Dinner at a restaurant"]
    ];
    const expenses = expenseSeed.map((e,i)=>({
      id:e[0], title:e[1], amount:e[2], paidBy:e[3], groupId:"flat302", category:e[4],
      date:e[5], description:e[6], method:"equal", memberIds:["aman","rahul","karan","mohit"], createdAt:e[5],
      splits:["aman","rahul","karan","mohit"].map(id=>({memberId:id, amount:Number((e[2]/4).toFixed(2))}))
    }));
    return { users, groups:[group], expenses, settlements:[], sessionUserId:"aman", settings:{theme:"light",currency:"INR"}, activity:[
      {id:"a1",text:"Aman created Flat 302",date:"2026-11-20"}
    ]};
  },
  currentUser() {
    const data=this.get(); return data.users.find(u=>u.id===data.sessionUserId) || null;
  },
  ensureAuth() {
    if (!this.currentUser()) { location.href="login.html"; return false; }
    return true;
  }
};
