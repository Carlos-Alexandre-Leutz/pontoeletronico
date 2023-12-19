import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyDUh3GJHdsSiDEJnfZGKfZIPwkQsGctM_o",
  authDomain: "ponto-eletronico-alexandre.firebaseapp.com",
  projectId: "ponto-eletronico-alexandre",
  storageBucket: "ponto-eletronico-alexandre.appspot.com",
  messagingSenderId: "301921361900",
  appId: "1:301921361900:web:90d661a18f391b393e6ac9",
  measurementId: "G-VRCEPTZET0",
};

initializeApp(firebaseConfig);
createApp(App).use(store).use(router).mount("#app");
