let OFFERS = JSON.parse(localStorage.getItem("offers")) || [
  {id:1, operator:"Orange", price:500, data:"1.5Go", validity:"24h"},
  {id:2, operator:"Orange", price:700, data:"3.5Go", validity:"24h"},
  {id:3, operator:"Orange", price:1000, data:"5Go", validity:"Inconnu"},
  {id:4, operator:"Orange", price:200, data:"300Mo", validity:"Inconnu"}
];

function saveOffers(){
  localStorage.setItem("offers", JSON.stringify(OFFERS));
}

function quickBudget(value){
  document.getElementById("budgetInput").value = value;
  searchOffers();
}

function searchOffers(){
  const budget = parseInt(document.getElementById("budgetInput").value);
  if(!budget) return;

  let filtered = OFFERS.filter(o => o.price <= budget);
  filtered.sort((a,b)=>a.price - b.price);

  const results = document.getElementById("results");
  results.innerHTML = "";

  if(filtered.length === 0){
    results.innerHTML = "<p>Aucune offre disponible.</p>";
    return;
  }

  filtered.forEach((offer,index)=>{
    results.innerHTML += `
      <div class="card">
        <div class="price">${offer.price} FCFA</div>
        <div class="data">${offer.data} • ${offer.validity}</div>
        ${index===0 ? '<div class="badge">Meilleure valeur</div>' : ''}
      </div>
    `;
  });
}

function openAdmin(){
  document.getElementById("adminPanel").style.display="block";
  renderAdmin();
}

function closeAdmin(){
  document.getElementById("adminPanel").style.display="none";
}

function renderAdmin(){
  const list = document.getElementById("adminList");
  list.innerHTML = "";

  OFFERS.forEach(o=>{
    list.innerHTML += `
      <div>
        <input value="${o.price}" onchange="updateOffer(${o.id}, this.value)">
        ${o.data}
      </div>
    `;
  });
}

function updateOffer(id,value){
  let offer = OFFERS.find(o=>o.id===id);
  offer.price = parseInt(value);
  saveOffers();
}
