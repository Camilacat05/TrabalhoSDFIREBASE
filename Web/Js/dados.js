window.onload = inicializar;
var formulario_dados;
var refEnviar_dados;
var tbodyTableDados;
var CREATE = "Enviar Dados";
var UPDATE = "Modificar Dados";
var modo = CREATE;
var refDadosEditar;
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
    var db = firebase.database();

  //LOGIN

  
    //LOGIN
  
    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        // User is signed in.
    
        document.getElementById("user_div").style.display = "block";
        document.getElementById("login_div").style.display = "none";
    
        var user = firebase.auth().currentUser;
    
        if(user != null){
    
          var email_id = user.email;
          window.location.href="C:/Users/Milton/Desktop/CRUD/index.html";
          window.alert(document.getElementById("user_para").innerHTML = "Bem vindo : " + email_id);
         
          
        }
  
        
      } else {
        // No user is signed in.
      
        document.getElementById("user_div").style.display = "none";
        document.getElementById("login_div").style.display = "block";
  
      }
      
    });
    
    function login(){
    
      var userEmail = document.getElementById("email_field").value;
      var userPass = document.getElementById("password_field").value;
    
      firebase.auth().signInWithEmailAndPassword(userEmail, userPass).catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
    
        window.alert("Error : " + errorMessage);
    
        // ...
      });
    
    }
    
    function logout(){
      firebase.auth().signOut();
      window.location.href="file:///C:/Users/samca/Desktop/SD/Login.html";
    }
    
function inicializar(){
    formulario_dados= document.getElementById("form-dates");
    formulario_dados.addEventListener("submit", enviarDadosFirebase, false);

    tbodyTableDados = document.getElementById("tbody-table-dados");
    
    refEnviar_dados = firebase.database().ref().child("Trabalhos");
    mostrarDadosFirebase();
}

function mostrarDadosFirebase(){
    refEnviar_dados.on("value", function(snap){
        var dados =snap.val();
        var filaDados = "";

        for(var key in dados){
            filaDados += "<tr>" +
                            "<td>" + dados[key].nomeTrabalho + "</td>" +
                            "<td>" + dados[key].nomeAutor + "</td>" +
                            "<td>" + dados[key].linguagem + "</td>" +
                            "<td>" + dados[key].enderecoGit + "</td>" +
                            "<td>" + dados[key].usuario + "</td>" +
                            "<td>" +
                            '<button class="btn btn-default editar" dados= "' + key +'">' +
                                '<span class="glyphicon glyphicon-pencil"></span>' +
                            '</button>' +

                            "</td>"+
                            '<td>' + 
                                '<button class= "btn btn-danger apagar" dados= "' + key +'">' +
                                    '<span class="glyphicon glyphicon-trash"></span>' +
                                '</button>' +
                            '</td>'+
                        "</tr>";
        }
        tbodyTableDados.innerHTML = filaDados;

        if(filaDados != ""){
            var elementoApagados = document.getElementsByClassName("apagar");
            for(var i=0; i <elementoApagados.length; i++){
                elementoApagados[i].addEventListener("click", apagadarDadosFirebase, false);
            }

            var elementoEditados = document.getElementsByClassName("editar");
            for(var i=0; i <elementoEditados.length; i++){
                elementoEditados[i].addEventListener("click", editarDadosFirebase, false);
            }
        }

    });
}

function editarDadosFirebase(){
    var chaveDadosEditar = this.getAttribute("dados");
    refDadosEditar = refEnviar_dados.child(chaveDadosEditar);
    
    refDadosEditar.once("value", function(snap){
        var dados = snap.val();

        document.getElementById("Inserir-curso").value = dados.nomeTrabalho;
        document.getElementById("Inserir-autor").value = dados.nomeAutor;
        document.getElementById("Inserir-linguagem").value = dados.linguagem;
        document.getElementById("Inserir-git").value = dados.enderecoGit;
        document.getElementById("Inserir-usuario").value = dados.usuario;
        document.getElementById("Inserir-senha").value = dados.senha;

    });
    document.getElementById("botao-enviar").value = UPDATE;
    modo = UPDATE;
}


function apagadarDadosFirebase(){
    var chaveDadosApagar = this.getAttribute("dados");
    var refDadosApagar = refEnviar_dados.child(chaveDadosApagar);
    refDadosApagar.remove();
}

function enviarDadosFirebase(event){
    event.preventDefault();
    switch(modo) {
        case CREATE:
        firebase.database().ref("Trabalhos").child(event.target.usuario.value).set({
            enderecoGit: event.target.enderecoGit.value,
            linguagem: event.target.linguagem.value,
            nomeAutor: event.target.nomeAutor.value,
            nomeTrabalho: event.target.nomeTrabalho.value,
            usuario: event.target.usuario.value,
            senha: event.target.senha.value

          });
        break;

        case UPDATE:
        refDadosEditar.update({
            enderecoGit: event.target.enderecoGit.value,
            linguagem: event.target.linguagem.value,
            nomeAutor: event.target.nomeAutor.value,
            nomeTrabalho: event.target.nomeTrabalho.value,
            usuario: event.target.usuario.value,
            senha: event.target.senha.value
        });
        modo=CREATE;
        document.getElementById("botao-enviar").value = CREATE;
        break;

    }
    
    formulario_dados.reset();
}
