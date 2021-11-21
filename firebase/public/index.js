const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
//const ui = new firebaseui.auth.AuthUI(firebase.auth());

const whenSignedIn = document.getElementById('whenSignedIn');
const whenSignedOut = document.getElementById('whenSignedOut');

const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');

const balanceDisplay = document.getElementById('balanceDisplay');
const notifications = document.getElementById('notification');

signInBtn.onclick = () => auth.signInWithPopup(provider);

signOutBtn.onclick = () => auth.signOut();

var currentUser;

auth.onAuthStateChanged(user => {
    if (user) {
        // signed in
        currentUser = user;
        whenSignedIn.hidden = false;
        whenSignedOut.hidden = true;
        const usersRef = db.collection("users");
        usersRef.doc(user.uid).get().then((docSnapshot) => {
            if(!docSnapshot.exists){
                userRef.doc(user.uid).set({
                    balance: 1000
                });
                balanceDisplay.innerHTML = "Balance: " + 1000;
            }
            else{
                const userRef = usersRef.doc(user.uid);
                userRef.get().then(doc =>{
                    balanceDisplay.innerHTML = "Balance: " + doc.data().balance.toFixed(2);
                })
            }
        })
    } else {
        // not signed in
        currentUser = null;
        whenSignedIn.hidden = true;
        whenSignedOut.hidden = false;
        balanceDisplay.innerHTML = "Balance: X"
    }
});

//Creates map and fills with markers
function initMap() {
    let markers = [];
    let windows = [];
    var options = {
        zoom: 13,
        center: { lat: 53.34, lng: -6.26 }
    };
    var map = new google.maps.Map(document.getElementById("map"), options);
    let stationsRef = db.collection("stations");
    let i = 0;
    stationsRef.get().then((snapshot) => {
        snapshot.docs.forEach(doc => {
            let station = doc.data();
            markers[i] = new google.maps.Marker({
                position: { lat: station.position.u_, lng: station.position.h_ },
                map: map
            });
            windows[i] = new google.maps.InfoWindow({
                content: windowContent(station, doc.id)
            });
            i++;
        });
        for (let j = 0; j < markers.length; j++) {
            markers[j].addListener('click', () => {
                windows[j].open(map, markers[j]);
            })
        }
    });
}

//Creates html content for popup window
function windowContent(station, id) {
    let content = "";
    content += '<div class="popupWindow animate" id="good">';
    content += '<h3> Rate: €' + station.rate + ' per hour</h3>';
    content += '<h3> Rating: ' + station.rating + ' <span class="fa fa-star"></span></h3>';
    content += '<h3> Address: ' + station.address + '</h3>';
    content += '<form class="appointmentForm">';
    content += '<input type="date" id="date" name="date" required="required">';
    content += '<br />';
    content += '<br />';
    content += '<label id="output1" for="startTime">Start: </label>';
    content += '<input type="range" class="startTime" name="startTime" min="0" max="144" value="72" oninput="this.previousElementSibling.innerHTML=time(this.value)" required="required">';
    content += '<br />';
    content += '<br />';
    content += '<label id="output2" for="endTime">End: </label>';
    content += '<input type="range" class="endTime" name="endTime" min="0" max="144" value="72" oninput="this.previousElementSibling.innerHTML=time(this.value)" required="required">';
    content += '<br />';
    content += '<br />';
    content += '<p class="error"></p>';
    content += '<input type="button" id="submit" name="submit" value="Book Appointment" onclick="bookAppointment(this.parentElement,\'' + id + '\')" required="required">';
    content += '</form>';
    content += "</div>";
    return content;
}


//Books appointment and adds data to firestore
function bookAppointment(form, stationID) {
  var errors = [];
  var duration = form.endTime.value - form.startTime.value;
  var minutes = duration %6;
  duration /=6;
  duration += minutes;
  console.log(duration);
  var cost = 0;
  if(currentUser == null){
      errors.push("Must be logged in");
  }
  if(form.date.value == ""){
    errors.push("Date is required");
  }
  if(duration < 1){
    errors.push("Minimum appointment length is 1 hour");
  }
  if(errors.length > 0){
    form.submit.previousElementSibling.innerHTML = errors.join("<br/>");
  }
  else{
    var station = db.collection("stations").doc(stationID);
    var owner = "";
    station.get().then(doc => {
      owner = doc.data().owner;
      owner = owner.replace(/\s+/g, '');
      cost = Number(duration * doc.data().rate);
      cost = +cost.toFixed(2);
      console.log(cost);
      form.submit.previousElementSibling.innerHTML = "";
      var appointment = db.collection("appointments").add({
        date: form.date.value,
        start: time(form.startTime.value),
        end: time(form.endTime.value),
        user: currentUser.uid,
        station: stationID,
        cost: cost
      });
      const renteeRef = db.collection("users").doc(currentUser.uid);
      renteeRef.update({
          balance: firebase.firestore.FieldValue.increment(cost*-1)
      });
      renteeRef.get().then(document =>{
          balanceDisplay.innerHTML = "Balance: " + document.data().balance.toFixed(2);
      })
      //console.log(owner[0]);
      const renterRef = db.collection("users").doc(owner);
      renterRef.update({
        balance: firebase.firestore.FieldValue.increment(cost)
      });
      notifications.innerHTML += '<li>Appointment booked</li> for ' + form.date.value + ' at ' + time(form.startTime.value);
      alert("Appointment Booked");
    });
  }
}

//Converts number from range slider into time
function time(number) {
    let hour = Math.floor(number / 6);
    let minute = (number % 6) * 10;
    if (minute < 10 && hour < 10) {
        return "0" + hour + ":" + "0" + minute;
    }
    if (minute < 10) {
        return hour + ":" + "0" + minute;
    }
    if (hour < 10) {
        return "0" + hour + ":" + minute;
    }
    return hour + ":" + minute;
}

function addStation(form){
    var errors = [];
    if(currentUser == null){
        errors.push("Must be logged in");
    }
    if(errors.length > 0){
        form.submit.previousElementSibling.innerHTML = errors.join("<br/>");
    }
    else{
        //let statiosRef = db.collection("stations");
        var newStation = db.collection("stations").add({
            owner: currentUser.uid,
            rate : form.rate.value,
            rating : Math.floor(Math.random() * Math.floor(6)),
            address: form.address.value,
            position: new Firestore.GeoPoint(form.latitude.value,form.longitude.value)
        });
    }
}

//clicking outside a notification box closes it
var box1 = document.getElementById('id01');
var box2 = document.getElementById('id02');
var box3 = document.getElementById('id03');
window.onclick = function (event) {
    if (event.target == box1 || event.target == box2 || event.target == box3) {
        box1.style.display = "none";
        box2.style.display = "none";
        box3.style.display = "none";
    }
}
