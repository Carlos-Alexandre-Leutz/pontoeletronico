<!-- Dashboard.vue -->
<template>
  <div style="width: 100%">
    <div class="centered-div">
      <nav class="navbar navbar-expand-lg bg-body-tertiary">
        <div class="container-fluid">
          <a class="navbar-brand" href="#">Many Controle de taréfas</a>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
              <li class="nav-item">
                <a class="nav-link active" aria-current="page" href="#">Home</a>
              </li>
            </ul>
            <form class="d-flex" role="search">
              <p v-if="user">Olá, {{ user.displayName }}!</p>
              <button class="btn btn-outline-success" @click="logout">
                Sair
              </button>
            </form>
          </div>
        </div>
      </nav>
      <ClockInClockOut></ClockInClockOut>
    </div>
  </div>
</template>

<script>
import ClockInClockOut from "../components/ClockInClockOut.vue";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

export default {
  data() {
    return {
      user: null,
    };
  },
  created() {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.user = user;
      } else {
        this.$router.push("/login");
      }
    });
  },
  components: {
    ClockInClockOut: ClockInClockOut,
  },
  methods: {
    logout() {
      const auth = getAuth();
      signOut(auth)
        .then(() => {
          console.log("Usuário deslogado com sucesso");
          this.$router.push("/login");
        })
        .catch((error) => {
          console.error("Erro ao deslogar:", error.message);
        });
    },
  },
};
</script>
<style scoped>
.main {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.centered-div {
  padding: 20px;
  border: 1px solid #ccc;
}
</style>
