<!-- Login.vue -->
<template>
  <div>
    <h1>Login</h1>
    <form @submit.prevent="login">
      <label for="email">Email:</label>
      <input type="email" v-model="email" required />
      <label for="password">Senha:</label>
      <input type="password" v-model="password" required />
      <button type="submit">Entrar</button>
    </form>
    <router-link to="/newAccount">Não tem conta?</router-link>
  </div>
</template>

<script>
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export default {
  data() {
    return {
      email: "",
      password: "",
    };
  },
  methods: {
    async login() {
      const auth = getAuth();
      try {
        await signInWithEmailAndPassword(auth, this.email, this.password);
        console.log("Usuário autenticado com sucesso");
        // Redirecione para a página após o login
        this.$router.push("/dashboard");
      } catch (error) {
        console.error("Erro ao autenticar:", error.message);
      }
    },
  },
};
</script>
