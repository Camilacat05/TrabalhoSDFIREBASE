// Initialize Firebase

var config = {
    apiKey: "AIzaSyBMSH1zZsSG68zpt-Gcxu84khY3Ssj9ilM",
    authDomain: "trabalhosd-42282.firebaseapp.com",
    databaseURL: "https://trabalhosd-42282.firebaseio.com",
    projectId: "trabalhosd-42282",
    storageBucket: "trabalhosd-42282.appspot.com",
    messagingSenderId: "94103743829"
  };
  firebase.initializeApp(config);
  
  
  
  const //send leads
        name = document.querySelector('#name'),
        nameat = document.querySelector('#nameat'),
        email = document.querySelector('#email'),
        lp = document.querySelector('#lp'),
        phone = document.querySelector('#phone'),
        nameuser = document.querySelector('#nameuser'),
        alert = document.querySelector('.alert'),
        button = document.querySelector('.send-form')

 const // login 
        overlay = document.querySelector('.overlay'),  
        userEmail = document.querySelector('#email-user'),
        password = document.querySelector('#password'),
        alertLogin = document.querySelector('.alert-login'),
        btnLogin = document.querySelector('.btn-login'),
        logout = document.querySelector('.logout')


  // start db reference  connection
  const dbRefer = firebase.database().ref('leads')


  // class reference 
  class FormLeads {
      constructor() {
            this.name =  name.value,  
            this.email = email.value,
            this.nameat = nameat.value,
            this.lp = lp.value,
            this.nameuser = nameuser.value,
            this.phone = phone.value,
            this.date = new Date().toISOString().replace('-', '/').split('T')[0].replace('-', '/'),
            this.time = new Date().getTime()
          }
  }

  // send form
  const sendForm = () => {
    dbRefer.push(new FormLeads())
  
  }
//CLEAN FORM
    const cleanForm =  () => {
          name.value = '' 
          email.value = ''
          phone.value = ''
          lp.value = ''
          nameuser.value = ''
          nameat.value = ''
    }

  //validate inputs   

  const validateForm = () => { 
    if(name.value   === '' || email.value === '' || phone.value === '' || nameat.value === '' || lp.value === '' || nameuser.value === '') {
        alert.classList.add('alert-danger','display')
        alert.innerHTML = 'one or more ipunts have wrong value , try agin  &#x1F915; '
        cleanForm()
    }else {
        alert.classList.remove('alert-danger')
        alert.classList.add('alert-success','display')
        alert.innerHTML = 'gotcha you are a new lead &#x1f604'
        sendForm() // send form function
        cleanForm()
    }
}

// submit form 
button.addEventListener('click', () => {
    validateForm();
})

//login validade
firebase.auth().onAuthStateChanged(user => {
    if (user) { // user logged
        overlay.style.display = 'none';
        logout.style.display = 'block';
        
        
    } else { // user not logged
        overlay.style.display = 'block';
        alertLogin.classList.add('alert', 'alert-danger')
        alertLogin.innerHTML = 'You need be a logged'

    }
})

//login function 
const loginFunction = (Email, Pass) => {
    Email = userEmail.value
    Pass = password.value
    //console.log(Email, Pass)
    firebase.auth().signInWithEmailAndPassword(Email, Pass).catch(function(error) {

        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
    
        alertLogin.classList.add('alert-danger')
        alertLogin.innerHTML = errorCode, + errorMessage
        // ...
    });

}
    //CLEAN FORM LOGIN
    const cleanLogin = ()  => {
        userEmail.value = ''
        password.value = ''
    }

    const logoutFunction = () => {
        firebase.auth().signOut()
        cleanLogin();

    }

    // login event
    btnLogin.addEventListener('click', () => {
        loginFunction();
    })