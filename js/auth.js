document.addEventListener("DOMContentLoaded",()=>{
  const data=Storage.get();
  if(location.pathname.endsWith("login.html")){
    document.getElementById("loginForm").addEventListener("submit",e=>{
      e.preventDefault();
      const email=document.getElementById("loginEmail").value.trim().toLowerCase();
      const password=document.getElementById("loginPassword").value;
      const user=data.users.find(u=>u.email.toLowerCase()===email&&u.password===password);
      if(!user){document.getElementById("loginError").textContent="Invalid email or password.";return;}
      data.sessionUserId=user.id; Storage.set(data); location.href="index.html";
    });
  }
  if(location.pathname.endsWith("register.html")){
    document.getElementById("registerForm").addEventListener("submit",e=>{
      e.preventDefault();
      const name=document.getElementById("registerName").value.trim();
      const email=document.getElementById("registerEmail").value.trim().toLowerCase();
      const password=document.getElementById("registerPassword").value;
      if(name.length<2||password.length<6||!email.includes("@")){document.getElementById("registerError").textContent="Enter a valid name, email, and password.";return;}
      if(data.users.some(u=>u.email.toLowerCase()===email)){document.getElementById("registerError").textContent="An account with this email already exists.";return;}
      const user={id:Storage.uid("user"),name,email,password,currency:"INR"};
      data.users.push(user); data.sessionUserId=user.id; Storage.set(data); location.href="index.html";
    });
  }
});
