const Calculations = {
  round(amount) { return Math.round((Number(amount)+Number.EPSILON)*100)/100; },
  equalSplit(amount, memberIds) {
    if (!memberIds.length) return [];
    const base=this.round(amount/memberIds.length);
    const splits=memberIds.map(id=>({memberId:id,amount:base}));
    const difference=this.round(amount-splits.reduce((sum,s)=>sum+s.amount,0));
    splits[splits.length-1].amount=this.round(splits[splits.length-1].amount+difference);
    return splits;
  },
  percentageSplit(amount, memberIds, percentages) {
    const splits=[];
    let allocated=0;
    memberIds.forEach((id,index)=>{
      if (index===memberIds.length-1) splits.push({memberId:id,amount:this.round(amount-allocated)});
      else { const value=this.round(amount*(Number(percentages[id]||0)/100)); allocated=this.round(allocated+value); splits.push({memberId:id,amount:value}); }
    });
    return splits;
  },
  customSplit(amount, memberIds, customAmounts) {
    return memberIds.map(id=>({memberId:id,amount:this.round(Number(customAmounts[id]||0))}));
  },
  groupBalances(groupId) {
    const data=Storage.get();
    const group=data.groups.find(g=>g.id===groupId);
    if (!group) return [];
    const balances=Object.fromEntries(group.memberIds.map(id=>[id,0]));
    data.expenses.filter(e=>e.groupId===groupId).forEach(e=>{
      if (balances[e.paidBy] !== undefined) balances[e.paidBy]=this.round(balances[e.paidBy]+Number(e.amount));
      (e.splits||[]).forEach(s=>{ if (balances[s.memberId] !== undefined) balances[s.memberId]=this.round(balances[s.memberId]-Number(s.amount)); });
    });
    data.settlements.filter(s=>s.groupId===groupId).forEach(s=>{
      if (balances[s.payerId] !== undefined) balances[s.payerId]=this.round(balances[s.payerId]+Number(s.amount));
      if (balances[s.receiverId] !== undefined) balances[s.receiverId]=this.round(balances[s.receiverId]-Number(s.amount));
    });
    return group.memberIds.map(id=>({memberId:id,balance:this.round(balances[id])}));
  },
  simplifyDebts(balances) {
    const debtors=balances.filter(b=>b.balance<-.005).map(b=>({memberId:b.memberId,amount:this.round(-b.balance)})).sort((a,b)=>b.amount-a.amount);
    const creditors=balances.filter(b=>b.balance>.005).map(b=>({memberId:b.memberId,amount:b.balance})).sort((a,b)=>b.amount-a.amount);
    const settlements=[];
    let i=0,j=0;
    while(i<debtors.length&&j<creditors.length){
      const amount=this.round(Math.min(debtors[i].amount,creditors[j].amount));
      if(amount>0) settlements.push({payerId:debtors[i].memberId,receiverId:creditors[j].memberId,amount});
      debtors[i].amount=this.round(debtors[i].amount-amount);
      creditors[j].amount=this.round(creditors[j].amount-amount);
      if(debtors[i].amount<=.005)i++;
      if(creditors[j].amount<=.005)j++;
    }
    return settlements;
  },
  validateSplit(amount, splits) {
    const total=splits.reduce((sum,s)=>sum+Number(s.amount||0),0);
    return this.round(total)===this.round(amount);
  }
};
